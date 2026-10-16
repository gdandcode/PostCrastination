import { accessible } from './school.mjs';
import { saveAttachments } from './discussions.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function notify(db,uid,key,assignmentId,message,target={}){
 const classId=target.classId||(assignmentId?(await db.query('SELECT class_id FROM app.assignments WHERE id=$1',[assignmentId])).rows[0]?.class_id:null);
 await db.query('INSERT INTO app.school_notifications(user_uid,event_key,assignment_id,message,class_id,post_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_uid,event_key) DO NOTHING',[uid,key,assignmentId,message,classId,target.postId||null]);
}
export async function visibleNotifications(db,uid){
 return (await db.query(`SELECT n.id,n.assignment_id,n.class_id,n.post_id,n.message,n.read_at,n.created_at FROM app.school_notifications n WHERE n.user_uid=$1 AND (
  n.assignment_id IS NOT NULL AND EXISTS(SELECT 1 FROM app.assignments a JOIN app.classes c ON c.id=a.class_id WHERE a.id=n.assignment_id AND (c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1) OR a.published AND (EXISTS(SELECT 1 FROM app.memberships m WHERE m.class_id=c.id AND m.student_uid=$1) OR EXISTS(SELECT 1 FROM app.assignment_extras e WHERE e.assignment_id=a.id AND e.student_uid=$1))))
  OR n.post_id IS NOT NULL AND EXISTS(SELECT 1 FROM app.discussion_posts p JOIN app.classes c ON c.id=p.class_id WHERE p.id=n.post_id AND NOT p.deleted AND (p.parent_id IS NULL OR EXISTS(SELECT 1 FROM app.discussion_posts parent WHERE parent.id=p.parent_id AND NOT parent.deleted)) AND (c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1) OR c.discussions_enabled AND EXISTS(SELECT 1 FROM app.memberships m WHERE m.class_id=c.id AND m.student_uid=$1)))
 ) ORDER BY (n.read_at IS NULL) DESC,n.created_at DESC LIMIT 100`,[uid])).rows;
}
export async function notifyAssignment(db,a){
 const recipients=(await db.query('SELECT student_uid AS uid FROM app.memberships WHERE class_id=$1 UNION SELECT student_uid FROM app.assignment_extras WHERE assignment_id=$2',[a.class_id,a.id])).rows;
 for(const row of recipients)await notify(db,row.uid,'new:'+a.id,a.id,'New assignment: '+a.title);
}
export async function notifications(db,uid,assignments){
 const today=(await db.query("SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date::text AS today,((now() AT TIME ZONE 'Europe/Warsaw')::date+1)::text AS tomorrow")).rows[0];
 for(const a of assignments.filter(a=>!a.owned&&a.published)){
  await notify(db,uid,'new:'+a.id,a.id,'New assignment: '+a.title);
  if(!a.done&&!['submitted','returned'].includes(a.work_status)&&[today.today,today.tomorrow].includes(a.details.due))await notify(db,uid,'due:'+a.id+':'+a.details.due,a.id,'Due '+a.details.due+': '+a.title);
 }
 return visibleNotifications(db,uid);
}
async function workView(db,a,uid){
 const w=(await db.query('SELECT * FROM app.submission_work WHERE assignment_id=$1 AND student_uid=$2',[a.id,uid])).rows[0];
 if(!w)return {status:'not_started',version:0,answer:'',files:[],attempts:[]};
 const files=(await db.query('SELECT id,name,octet_length(content) AS size FROM app.attachments WHERE work_id=$1',[w.id])).rows;
 const attempts=(await db.query(`SELECT s.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'size',octet_length(f.content))) FROM app.attachments f WHERE f.attempt_id=s.id),'[]') AS files FROM app.submission_attempts s WHERE work_id=$1 ORDER BY number DESC`,[w.id])).rows;
 return {status:w.status,version:w.version,answer:w.answer,files,attempts};
}
export async function submissionRequest(db,identity,method,path,b={}){
 const uid=identity.uid;
 if(method==='GET'&&path==='/api/school/notifications')return {notifications:await visibleNotifications(db,uid)};
 const read=path.match(/^\/api\/school\/notifications\/([^/]+)\/read$/);
 if(read&&method==='POST'){
  if(read[1]==='all')await db.query('UPDATE app.school_notifications SET read_at=now() WHERE user_uid=$1 AND read_at IS NULL',[uid]);
  else {if(!/^[a-f0-9-]{36}$/i.test(read[1]))fail('Invalid notification.');await db.query('UPDATE app.school_notifications SET read_at=now() WHERE id=$1 AND user_uid=$2',[read[1],uid]);}
  return {ok:true};
 }
 const match=path.match(/^\/api\/school\/assignments\/([^/]+)\/(work|review-work)$/);
 if(!match)fail('Not found.',404);
 const [,assignmentId,action]=match;
 const a=await accessible(db,uid,assignmentId,action==='review-work');
 if(method==='POST')await db.query('SELECT id FROM app.assignments WHERE id=$1 FOR UPDATE',[a.id]);
 if(action==='work'){
  if(a.can_teach)fail('Open student submissions from Progress & grades.',403);
  if(method==='GET')return workView(db,a,uid);
  if(method!=='POST')fail('Method not allowed.',405);
  if(!['save','submit','revise'].includes(b.action)||!Number.isInteger(b.version)||b.version<0)fail('Invalid submission action.');
  await db.query('INSERT INTO app.submission_work(assignment_id,student_uid) VALUES($1,$2) ON CONFLICT DO NOTHING',[a.id,uid]);
  const w=(await db.query('SELECT * FROM app.submission_work WHERE assignment_id=$1 AND student_uid=$2 FOR UPDATE',[a.id,uid])).rows[0];
  if(w.version!==b.version)fail('This work changed in another tab. Reload the saved work before trying again.',409);
  if(b.action==='revise'){
   if(!['returned','changes_requested'].includes(w.status))fail('Your teacher must return the work before you can revise it.',409);
   const last=(await db.query('SELECT * FROM app.submission_attempts WHERE work_id=$1 ORDER BY number DESC LIMIT 1',[w.id])).rows[0];
   await db.query('INSERT INTO app.attachments(work_id,name,content) SELECT $1,name,content FROM app.attachments WHERE attempt_id=$2',[w.id,last.id]);
   await db.query("UPDATE app.submission_work SET answer=$2,status='in_progress',version=version+1,updated_at=now() WHERE id=$1",[w.id,last.answer]);
   await db.query('UPDATE app.assignment_results SET done=false,completed_at=NULL WHERE assignment_id=$1 AND student_uid=$2',[a.id,uid]);
   return workView(db,a,uid);
  }
  if(w.status!=='in_progress')fail('This work has already been submitted. Wait for your teacher to return it.',409);
  if(typeof b.answer!=='string'||b.answer.length>20000)fail('Your answer can contain up to 20,000 characters.');
  await saveAttachments(db,'work',w.id,b.files);
  const fileCount=(await db.query('SELECT count(*)::int AS n FROM app.attachments WHERE work_id=$1',[w.id])).rows[0].n;
  if(b.action==='submit'&&!b.answer.trim()&&!fileCount)fail('Write an answer or attach a file before submitting.');
  await db.query('UPDATE app.submission_work SET answer=$2,version=version+1,updated_at=now() WHERE id=$1',[w.id,b.answer]);
  if(b.action==='submit'){
   const attempt=(await db.query('INSERT INTO app.submission_attempts(work_id,number,answer) SELECT $1,COALESCE(MAX(number),0)+1,$2 FROM app.submission_attempts WHERE work_id=$1 RETURNING *',[w.id,b.answer])).rows[0];
   await db.query('UPDATE app.attachments SET attempt_id=$2,work_id=NULL WHERE work_id=$1',[w.id,attempt.id]);
   await db.query("UPDATE app.submission_work SET status='submitted' WHERE id=$1",[w.id]);
   await db.query('INSERT INTO app.assignment_results(assignment_id,student_uid,done,completed_at) VALUES($1,$2,true,now()) ON CONFLICT(assignment_id,student_uid) DO UPDATE SET done=true,completed_at=now()',[a.id,uid]);
   await notify(db,a.owner_uid,'submitted:'+attempt.id,a.id,'New submission to review: '+a.title);
  }
  return workView(db,a,uid);
 }
 if(action==='review-work'&&method==='POST'){
  if(typeof b.studentId!=='string')fail('Choose a student.');
  const w=(await db.query('SELECT * FROM app.submission_work WHERE assignment_id=$1 AND student_uid=$2 FOR UPDATE',[a.id,b.studentId])).rows[0];
  if(!w)fail('No submission found.',404);
  const latest=(await db.query('SELECT * FROM app.submission_attempts WHERE work_id=$1 ORDER BY number DESC LIMIT 1',[w.id])).rows[0];
  if(w.status!=='submitted'||latest?.id!==b.attemptId)fail('This submission has changed or was already returned. Refresh the review.',409);
  if(!['returned','changes_requested'].includes(b.action))fail('Choose Return work or Request changes.');
  if(typeof b.feedback!=='string'||b.feedback.length>3000)fail('Feedback can contain up to 3,000 characters.');
  if(b.action==='changes_requested'&&!b.feedback.trim())fail('Explain what the student should change.');
  const grade=b.grade||null;
  if(grade&&(!a.details.graded||!a.details.options.includes(grade)))fail('Choose a grade from this assignment’s scale.');
  if(b.action==='returned'&&a.details.graded&&!grade)fail('Choose a grade before returning this graded assignment.');
  await db.query('UPDATE app.submission_attempts SET review_status=$2,grade=$3,feedback=$4,reviewed_at=now() WHERE id=$1',[latest.id,b.action,grade,b.feedback.trim()]);
  await db.query('UPDATE app.submission_work SET status=$2,version=version+1,updated_at=now() WHERE id=$1',[w.id,b.action]);
  await db.query('UPDATE app.assignment_results SET grade=$3,feedback=$4,done=$5,grade_revision=grade_revision+1 WHERE assignment_id=$1 AND student_uid=$2',[a.id,w.student_uid,grade,b.feedback.trim(),b.action==='returned']);
  await notify(db,w.student_uid,'review:'+latest.id,a.id,(b.action==='returned'?'Work returned: ':'Changes requested: ')+a.title);
  return {ok:true};
 }
 fail('Not found.',404);
}
