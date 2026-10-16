import {assertPointAllowed,featuresFor} from './features.mjs';
import {createHash} from 'node:crypto';
import {classAccess} from './discussions.mjs';
export const categories=['Inappropriate use of devices','Non-compliance with uniform requirements','Failure to complete homework','Academic dishonesty','Inappropriate behaviour','Failure to follow instructions'];
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const id=x=>{if(typeof x!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x))fail('Invalid record.');return x;};
function text(x,max,label){if(typeof x!=='string'||!x.trim()||x.trim().length>max)fail(`Enter ${label} (up to ${max} characters).`);return x.trim();}
export async function behaviourRequest(db,identity,method,path,b={}){
 const uid=identity.uid;
 if(method==='GET'){const f=await featuresFor(db,uid);if(f.mode==='disabled'&&['/api/behaviour/student','/api/behaviour/teacher','/api/behaviour/leaderboard'].includes(path))return path.endsWith('leaderboard')?{students:[],school:f.name}:{points:[],classes:[]};}
 if(method==='GET'&&path==='/api/behaviour/leaderboard'){
  const profile=(await db.query('SELECT school_id,account_role FROM app.community_profiles WHERE firebase_uid=$1',[uid])).rows[0];
  if(profile?.account_role!=='student'||!profile.school_id)fail('Leaderboards are available to signed-in school students.',403);
  const rows=(await db.query(`SELECT p.id,p.full_name AS name,p.year_group AS "yearGroup",p.firebase_uid=$2 AS "isYou",
   count(b.id) FILTER(WHERE b.kind='commendation' AND owner.school_id=$1)::int AS commendations,
   count(b.id) FILTER(WHERE b.kind='demerit' AND owner.school_id=$1)::int AS demerits
   FROM app.community_profiles p LEFT JOIN app.behaviour_points b ON b.student_uid=p.firebase_uid
   LEFT JOIN app.classes c ON c.id=b.class_id LEFT JOIN app.community_profiles owner ON owner.firebase_uid=c.owner_uid
   WHERE p.school_id=$1 AND p.account_role='student' GROUP BY p.id ORDER BY lower(p.full_name),p.id`,[profile.school_id,uid])).rows;
  return {students:rows,school:(await db.query('SELECT name FROM app.schools WHERE id=$1',[profile.school_id])).rows[0].name};
 }
 const classMatch=path.match(/^\/api\/behaviour\/classes\/([^/]+)$/);
 if(method==='GET'&&classMatch){const c=await classAccess(db,uid,id(classMatch[1]),true);
 const students=(await db.query(`SELECT m.student_uid AS id,COALESCE(p.full_name,'') AS name FROM app.memberships m LEFT JOIN app.community_profiles p ON p.firebase_uid=m.student_uid WHERE m.class_id=$1 ORDER BY lower(p.full_name) NULLS LAST,m.student_uid`,[c.id])).rows;
 return {classInfo:{id:c.id,name:c.name,subject:c.subject},students,categories};}
 if(method==='GET'&&['/api/behaviour/student','/api/behaviour/teacher'].includes(path)){
 const teacher=path.endsWith('/teacher');
 const points=(await db.query(`SELECT b.id,b.class_id,b.kind,b.title,b.description,to_char(b.point_date,'YYYY-MM-DD') AS date,b.subject,b.category,b.intervention,b.intervention_notes,b.created_at,
 c.name AS class_name,COALESCE(NULLIF(tp.full_name,''),tp.display_name,'Teacher') AS teacher,COALESCE(sp.full_name,'') AS student,b.teacher_uid AS teacher_id
 FROM app.behaviour_points b JOIN app.classes c ON c.id=b.class_id LEFT JOIN app.community_profiles tp ON tp.firebase_uid=b.teacher_uid LEFT JOIN app.community_profiles sp ON sp.firebase_uid=b.student_uid WHERE b.${teacher?'teacher_uid':'student_uid'}=$1 ORDER BY b.point_date DESC,b.created_at DESC,b.id`,[uid])).rows;
 const classes=teacher?(await db.query('SELECT c.id,c.name,c.subject FROM app.classes c WHERE c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1) ORDER BY lower(c.name),c.id',[uid])).rows:[];
 return {points,classes};}
 if(method==='POST'&&path==='/api/behaviour/points/bulk'){
  const c=await classAccess(db,uid,id(b.classId),true);
 await assertPointAllowed(db,uid,c.id,b.kind);
  await db.query('SELECT id FROM app.classes WHERE id=$1 FOR UPDATE',[c.id]);
  if(!Array.isArray(b.studentIds)||!b.studentIds.length||b.studentIds.length>500||b.studentIds.some(s=>typeof s!=='string'||!s||s.length>128)||new Set(b.studentIds).size!==b.studentIds.length)fail('Select between 1 and 500 different students.');
  const studentIds=[...b.studentIds].sort(),request=id(b.requestId);
  const hash=createHash('sha256').update(JSON.stringify([c.id,studentIds,b.kind,b.title,b.description,b.date,b.subject,b.category??null,b.intervention??false,b.interventionNotes??''])).digest('hex');
  const previous=(await db.query('SELECT payload_hash,result FROM app.behaviour_batches WHERE teacher_uid=$1 AND request_id=$2',[uid,request])).rows[0];
  if(previous){if(previous.payload_hash!==hash)fail('This bulk submission was already saved with different details. Reopen the form.',409);return previous.result;}
  const roster=(await db.query('SELECT student_uid FROM app.memberships WHERE class_id=$1',[c.id])).rows.map(r=>r.student_uid);
  if(studentIds.some(s=>!roster.includes(s)))fail('Every selected student must be in this class. Refresh the roster.',403);
  const points=[];
  for(const studentId of studentIds){
   const hex=createHash('sha256').update('bulk-point:'+uid+':'+request+':'+studentId).digest('hex').slice(0,32);
   const childRequest=hex.slice(0,8)+'-'+hex.slice(8,12)+'-5'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20);
   points.push(await behaviourRequest(db,identity,'POST','/api/behaviour/points',{...b,studentId,requestId:childRequest}));
  }
  const result={count:points.length,points};
  await db.query('INSERT INTO app.behaviour_batches(teacher_uid,request_id,payload_hash,result) VALUES($1,$2,$3,$4)',[uid,request,hash,result]);
  return result;
 }
 if(method==='POST'&&path==='/api/behaviour/points'){
 const c=await classAccess(db,uid,id(b.classId),true);
 await assertPointAllowed(db,uid,c.id,b.kind);
 // Membership is checked while holding the class lock, consistent with class mutations.
 await db.query('SELECT id FROM app.classes WHERE id=$1 FOR UPDATE',[c.id]);
 if(typeof b.studentId!=='string'||!b.studentId||b.studentId.length>128)fail('Select a student.');
 const member=await db.query('SELECT 1 FROM app.memberships WHERE class_id=$1 AND student_uid=$2',[c.id,b.studentId]);if(!member.rowCount)fail('This student is not in this class.',403);
 if(!['commendation','demerit'].includes(b.kind))fail('Choose commendation or demerit.');
 const title=text(b.title,160,'a title'),description=text(b.description,20000,'a description'),subject=text(b.subject,100,'a subject');
 if(typeof b.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||isNaN(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date)fail('Enter a valid date.');
 let category=null,intervention=false,notes='';
 if(b.kind==='demerit'){if(!categories.includes(b.category))fail('Choose a demerit category.');category=b.category;if(typeof b.intervention!=='boolean')fail('Choose whether there was an intervention.');intervention=b.intervention;
 if(typeof b.interventionNotes!=='string'||b.interventionNotes.length>2000)fail('Intervention notes must be at most 2000 characters.');notes=intervention?b.interventionNotes.trim():'';}
 else if(b.category||b.intervention||b.interventionNotes)fail('Commendations do not use a category or intervention.');
 const request=id(b.requestId),hash=createHash('sha256').update(JSON.stringify([c.id,b.studentId,b.kind,title,description,b.date,subject,category,intervention,notes])).digest('hex');
 const inserted=await db.query(`INSERT INTO app.behaviour_points(class_id,teacher_uid,student_uid,kind,title,description,point_date,subject,category,intervention,intervention_notes,request_id,payload_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(teacher_uid,request_id) DO NOTHING RETURNING id`,[c.id,uid,b.studentId,b.kind,title,description,b.date,subject,category,intervention,notes,request,hash]);
 if(inserted.rowCount)return inserted.rows[0];
 const old=(await db.query('SELECT id,payload_hash FROM app.behaviour_points WHERE teacher_uid=$1 AND request_id=$2',[uid,request])).rows[0];if(old.payload_hash!==hash)fail('This submission was already saved with different details. Reopen the form.',409);return {id:old.id};
 }
 fail('Not found.',404);
}
