import {notify} from './submissions.mjs';
import { readFileSync } from 'node:fs';
const emojiChoices=new Set(JSON.parse(readFileSync(new URL('../../src/reactionEmojis.json',import.meta.url),'utf8')).map(([emoji])=>emoji));
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const validId=id=>{if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||''))fail('Invalid record.');return id;};
export async function classAccess(db,uid,id,ownerOnly=false) {
 const c=(await db.query(`SELECT c.*, (c.owner_uid=$2 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$2)) AS can_teach FROM app.classes c WHERE id=$1 AND ((owner_uid=$2 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$2)) ${ownerOnly?'':'OR EXISTS(SELECT 1 FROM app.memberships m WHERE m.class_id=c.id AND m.student_uid=$2)'})`,[validId(id),uid])).rows[0];
 if(!c)fail('Class not found.',404);return c;
}
// File bytes live alongside their owner record, so failed saves roll back together.
export async function saveAttachments(db,kind,id,files=[]) {
 if(!Array.isArray(files)||files.length>10)fail('Attach up to 10 files.');
 const column={assignment:'assignment_id',post:'post_id',work:'work_id',task:'task_id'}[kind];if(!column)fail('Invalid attachment owner.');
 const existing=(await db.query(`SELECT id,octet_length(content) AS size FROM app.attachments WHERE ${column}=$1`,[id])).rows;
 let total=0;const keep=[];
 for(const f of files){
  if(!f||typeof f!=='object')fail('Invalid attachment.');
  if(f.id){const found=existing.find(x=>x.id===f.id);if(!found||keep.includes(f.id))fail('Attachment does not belong to this record.',403);total+=found.size;keep.push(f.id);continue;}
  if(typeof f.name!=='string'||!f.name.trim()||f.name.length>180||/[\x00-\x1f/\\]/.test(f.name))fail('Choose a valid file name.');
  if(typeof f.base64!=='string'||f.base64.length>13981016||(f.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.base64)))fail('Invalid file content.');
  const content=Buffer.from(f.base64,'base64');
  if(!content.length||content.length>10*1024*1024)fail('Each file must be between 1 byte and 10 MB.');
  total+=content.length;if(total>25*1024*1024)fail('Attachments must total 25 MB or less.');
  const row=(await db.query(`INSERT INTO app.attachments(${column},name,content) VALUES($1,$2,$3) RETURNING id`,[id,f.name.trim(),content])).rows[0];keep.push(row.id);
 }
 if(total>25*1024*1024)fail('Attachments must total 25 MB or less.');
 await db.query(`DELETE FROM app.attachments WHERE ${column}=$1 AND NOT(id=ANY($2::uuid[]))`,[id,keep]);
}
export async function discussionRequest(db,identity,method,path,b={}) {
 const uid=identity.uid;
 const file=path.match(/^\/api\/school\/files\/([^/]+)$/);
 if(file&&method==='GET'){
  // Authorisation is checked before selecting any bytes.
  const f=(await db.query('SELECT id,name,assignment_id,post_id,work_id,attempt_id,task_id FROM app.attachments WHERE id=$1',[validId(file[1])])).rows[0];
  if(!f)fail('File not found.',404);
  if(f.task_id){
   const own=await db.query('SELECT id FROM app.personal_tasks WHERE id=$1 AND owner_uid=$2',[f.task_id,uid]);if(!own.rowCount)fail('File not found.',404);
  }else if(f.work_id||f.attempt_id){
   const w=(await db.query(f.work_id?'SELECT w.*,c.owner_uid FROM app.submission_work w JOIN app.assignments a ON a.id=w.assignment_id JOIN app.classes c ON c.id=a.class_id WHERE w.id=$1':'SELECT w.*,c.owner_uid FROM app.submission_attempts s JOIN app.submission_work w ON w.id=s.work_id JOIN app.assignments a ON a.id=w.assignment_id JOIN app.classes c ON c.id=a.class_id WHERE s.id=$1',[f.work_id||f.attempt_id])).rows[0];
   if(!w||(w.student_uid!==uid&&(!f.attempt_id||w.owner_uid!==uid)))fail('File not found.',404);
   const {accessible}=await import('./school.mjs');await accessible(db,uid,w.assignment_id);
  }else if(f.assignment_id){
   const {accessible}=await import('./school.mjs');await accessible(db,uid,f.assignment_id);
  }else{
   const p=(await db.query('SELECT * FROM app.discussion_posts WHERE id=$1',[f.post_id])).rows[0];
   const c=await classAccess(db,uid,p.class_id);
   const parent=p.parent_id?(await db.query('SELECT deleted FROM app.discussion_posts WHERE id=$1',[p.parent_id])).rows[0]:null;
   if(!c.can_teach&&(!c.discussions_enabled||p.deleted||parent?.deleted))fail('File not found.',404);
  }
  return {download:true,name:f.name,content:(await db.query('SELECT content FROM app.attachments WHERE id=$1',[f.id])).rows[0].content};
 }
 const match=path.match(/^\/api\/school\/classes\/([^/]+)\/(settings|discussion)$/);
 if(match){
  const [,id,action]=match,c=await classAccess(db,uid,id,action==='settings');const teacher=c.can_teach;
  if(action==='settings'&&method==='POST'){
   if(typeof b.name!=='string'||!b.name.trim()||b.name.length>100||typeof b.subject!=='string'||b.subject.length>100)fail('Enter a class name and subject of up to 100 characters.');
   if(['discussionsEnabled','studentPosts','studentReplies'].some(k=>typeof b[k]!=='boolean'))fail('Invalid discussion settings.');
   await db.query('UPDATE app.classes SET name=$2,subject=$3,discussions_enabled=$4,student_posts=$5,student_replies=$6 WHERE id=$1',[id,b.name.trim(),b.subject.trim(),b.discussionsEnabled,b.studentPosts,b.studentReplies]);return {ok:true};
  }
  if(action==='discussion'){
   if(!teacher&&!c.discussions_enabled)fail('Class discussions are turned off.',403);
   if(method==='GET'){
    const rows=(await db.query(`SELECT p.id,p.parent_id,p.created_at,p.deleted,p.locked,p.author_uid=$2 AS mine, (p.author_uid=c.owner_uid OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=p.author_uid)) AS teacher,COALESCE(u.display_name,'Class member') AS author,
     CASE WHEN p.deleted THEN '' ELSE p.body END AS body,
     CASE WHEN p.deleted THEN '[]'::jsonb ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'size',octet_length(f.content))) FROM app.attachments f WHERE f.post_id=p.id),'[]') END AS files
     FROM app.discussion_posts p JOIN app.classes c ON c.id=p.class_id LEFT JOIN app.community_profiles u ON u.firebase_uid=p.author_uid WHERE p.class_id=$1 ORDER BY p.created_at,p.id`,[id,uid])).rows;
    const reactions=(await db.query(`SELECT r.post_id,r.emoji,r.user_uid=$2 AS mine,COALESCE(u.display_name,'Class member') AS name,u.id AS profile_id FROM app.post_reactions r JOIN app.discussion_posts p ON p.id=r.post_id LEFT JOIN app.community_profiles u ON u.firebase_uid=r.user_uid WHERE p.class_id=$1 AND NOT p.deleted ORDER BY r.created_at,r.user_uid`,[id,uid])).rows;
    for(const post of rows){const groups=new Map();for(const r of reactions.filter(r=>r.post_id===post.id)){if(!groups.has(r.emoji))groups.set(r.emoji,{emoji:r.emoji,count:0,mine:false,people:[]});const g=groups.get(r.emoji);g.count++;g.mine ||= r.mine;g.people.push({name:r.name,mine:r.mine,id:r.profile_id});}post.reactions=[...groups.values()];}
    return {posts:rows.filter(p=>teacher||!p.parent_id||!rows.find(parent=>parent.id===p.parent_id)?.deleted)};
   }
   if(method==='POST'){
    // Serialize posting with moderation/settings updates for this class.
    await db.query('SELECT id FROM app.classes WHERE id=$1 FOR UPDATE',[id]);
    const current=await classAccess(db,uid,id);
    if(!teacher&&(!current.discussions_enabled||!(b.parentId?current.student_replies:current.student_posts)))fail(b.parentId?'Student replies are turned off.':'Student posting is turned off.',403);
    if(b.parentId){const parent=(await db.query('SELECT * FROM app.discussion_posts WHERE id=$1 AND class_id=$2',[validId(b.parentId),id])).rows[0];if(!parent||parent.parent_id||parent.deleted)fail('That discussion is unavailable.');if(parent.locked&&!teacher)fail('Replies to this discussion are locked.',403);}
    if(typeof b.body!=='string'||b.body.length>5000||(!b.body.trim()&&!b.files?.length))fail('Write a message or attach a file (up to 5000 characters).');
    const p=(await db.query('INSERT INTO app.discussion_posts(class_id,author_uid,body,parent_id) VALUES($1,$2,$3,$4) RETURNING id',[id,uid,b.body.trim(),b.parentId||null])).rows[0];
    await saveAttachments(db,'post',p.id,b.files);
    const recipients=(await db.query('SELECT student_uid AS uid FROM app.memberships WHERE class_id=$1 UNION SELECT teacher_uid FROM app.class_teachers WHERE class_id=$1 UNION SELECT owner_uid FROM app.classes WHERE id=$1',[id])).rows;
    for(const member of recipients.filter(r=>r.uid!==uid))await notify(db,member.uid,'discussion:'+p.id,null,'New discussion message: '+c.name,{classId:id,postId:p.id});return p;
   }
  }
 }
 const reaction=path.match(/^\/api\/school\/posts\/([^/]+)\/reaction$/);
 if(reaction&&method==='POST'){
  if(!emojiChoices.has(b.emoji)||typeof b.active!=='boolean')fail('Choose an emoji from the reaction menu.');
  const initial=(await db.query('SELECT class_id FROM app.discussion_posts WHERE id=$1',[validId(reaction[1])])).rows[0];if(!initial)fail('Post not found.',404);
  await classAccess(db,uid,initial.class_id);await db.query('SELECT id FROM app.classes WHERE id=$1 FOR UPDATE',[initial.class_id]);
  const c=await classAccess(db,uid,initial.class_id);
  const p=(await db.query('SELECT p.deleted,parent.deleted AS parent_deleted FROM app.discussion_posts p LEFT JOIN app.discussion_posts parent ON parent.id=p.parent_id WHERE p.id=$1',[reaction[1]])).rows[0];
  if(p.deleted||p.parent_deleted)fail('This message is no longer available.',404);
  if(!c.can_teach&&!c.discussions_enabled)fail('Class discussions are turned off.',403);
  if(b.active)await db.query('INSERT INTO app.post_reactions(post_id,user_uid,emoji) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[reaction[1],uid,b.emoji]);
  else await db.query('DELETE FROM app.post_reactions WHERE post_id=$1 AND user_uid=$2 AND emoji=$3',[reaction[1],uid,b.emoji]);
  return {ok:true};
 }
 const moderation=path.match(/^\/api\/school\/posts\/([^/]+)\/moderate$/);
 if(moderation&&method==='POST'){
  const p=(await db.query('SELECT * FROM app.discussion_posts WHERE id=$1',[validId(moderation[1])])).rows[0];if(!p)fail('Post not found.',404);
  await classAccess(db,uid,p.class_id,true);await db.query('SELECT id FROM app.classes WHERE id=$1 FOR UPDATE',[p.class_id]);
  if(!['delete','restore','lock','unlock'].includes(b.action))fail('Choose a moderation action.');
  const column=['delete','restore'].includes(b.action)?'deleted':'locked';
  await db.query(`UPDATE app.discussion_posts SET ${column}=$2 WHERE id=$1`,[p.id,['delete','lock'].includes(b.action)]);return {ok:true};
 }
 fail('Not found.',404);
}
