import { notifications,notifyAssignment,notify } from './submissions.mjs';
import { saveAttachments } from './discussions.mjs';
import { randomBytes } from 'node:crypto';
import { ensureProfile } from './community.mjs';
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const str = (v,max,required=false) => { if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim())) fail('Please check the required fields and text lengths.'); return v.trim(); };
const uuid = v => { if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'')) fail('Invalid record.'); return v; };
export const scales = {'1-10':Array.from({length:10},(_,i)=>String(i+1)),RAG:['Red','Amber','Green'],'F-A+':['F','D-','D','D+','C-','C','C+','B-','B','B+','A-','A','A+'],'E-A*':['E','D','C','B','A','A*'],'Pass/fail':['Fail','Pass']};
export async function accessible(db,uid,id,owner=false) {
 const {rows}=await db.query(`SELECT a.*,c.owner_uid,(c.owner_uid=$2 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$2)) AS can_teach FROM app.assignments a JOIN app.classes c ON c.id=a.class_id WHERE a.id=$1 AND ((c.owner_uid=$2 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$2)) ${owner?'':`OR (a.published AND (EXISTS(SELECT 1 FROM app.memberships m WHERE m.class_id=c.id AND m.student_uid=$2) OR EXISTS(SELECT 1 FROM app.assignment_extras e WHERE e.assignment_id=a.id AND e.student_uid=$2)))`})`,[uuid(id),uid]);
 return rows[0]||fail('Assignment not found.',404);
}
export async function schoolRequest(db,identity,method,path,b={}) {
 const uid=identity.uid;
 if(method==='GET'&&path==='/api/school') {
  const classes=(await db.query(`SELECT c.*,(c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1)) AS owned,(SELECT count(*)::int FROM app.memberships m WHERE m.class_id=c.id) AS student_count FROM app.classes c WHERE (c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1)) OR EXISTS(SELECT 1 FROM app.memberships m WHERE m.class_id=c.id AND m.student_uid=$1) ORDER BY c.created_at`,[uid])).rows;
  const students=(await db.query(`SELECT DISTINCT m.student_uid AS id,p.display_name AS name FROM app.memberships m JOIN app.classes c ON c.id=m.class_id LEFT JOIN app.community_profiles p ON p.firebase_uid=m.student_uid WHERE (c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1)) ORDER BY name`,[uid])).rows;
  const assignments=(await db.query(`SELECT a.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'size',octet_length(f.content))) FROM app.attachments f WHERE f.assignment_id=a.id),'[]') AS files,ARRAY(SELECT e.student_uid FROM app.assignment_extras e WHERE e.assignment_id=a.id) AS extras,c.name AS class_name,(c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1)) AS owned,r.done,r.grade,r.feedback,COALESCE(w.status,'not_started') AS work_status FROM app.assignments a JOIN app.classes c ON c.id=a.class_id LEFT JOIN app.assignment_results r ON r.assignment_id=a.id AND r.student_uid=$1 LEFT JOIN app.submission_work w ON w.assignment_id=a.id AND w.student_uid=$1 WHERE (c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1)) OR (a.published AND (EXISTS(SELECT 1 FROM app.memberships m WHERE m.class_id=c.id AND m.student_uid=$1) OR EXISTS(SELECT 1 FROM app.assignment_extras e WHERE e.assignment_id=a.id AND e.student_uid=$1))) ORDER BY a.created_at DESC`,[uid])).rows;
  return {classes,students,assignments,notifications:await notifications(db,uid,assignments)};
 }
 if(method==='POST'&&path==='/api/school/classes') {
  return (await db.query('INSERT INTO app.classes(owner_uid,name,subject,code) VALUES($1,$2,$3,$4) RETURNING *',[uid,str(b.name,100,true),str(b.subject||'',100),randomBytes(6).toString('hex').toUpperCase()])).rows[0];
 }
 if(method==='POST'&&path==='/api/school/join') {
  await ensureProfile(db,identity);
  const c=(await db.query('SELECT id,owner_uid FROM app.classes WHERE code=$1',[str(b.code,32,true).replace(/\s/g,'').toUpperCase()])).rows[0];
  if(!c) fail('That class code was not found. Check it with your teacher.',404);
  if(c.owner_uid===uid) fail('You already own this class.');
  await db.query('INSERT INTO app.memberships(class_id,student_uid) VALUES($1,$2) ON CONFLICT DO NOTHING',[c.id,uid]); return {ok:true};
 }
 const edit=path.match(/^\/api\/school\/assignments\/([^/]+)\/edit$/);
 if(method==='POST'&&(path==='/api/school/assignments'||edit)) {
  if(edit){const previous=await accessible(db,uid,edit[1],true);if(previous.published)fail('Published assignments cannot be edited.');}
  const c=(await db.query('SELECT c.id FROM app.classes c WHERE c.id=$1 AND (c.owner_uid=$2 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$2))',[uuid(b.classId),uid])).rows[0];
  if(!c) fail('Choose one of your classes.',403);
  const title=str(b.title,160,true),instructions=str(b.instructions||'',10000);
  if(typeof b.graded!=='boolean'||typeof b.addToTasks!=='boolean'||typeof b.published!=='boolean') fail('Invalid assignment options.');
  const options=b.graded?(b.scale==='Custom'?str(b.customScale||'',300,true).split(',').map(s=>s.trim()).filter(Boolean):scales[b.scale]):[];
  if(!options||(b.graded&&!options.length)||options.length>30||new Set(options).size!==options.length) fail('Choose a valid grading scale with distinct values.');
  if(b.due&&(!/^\d{4}-\d{2}-\d{2}$/.test(b.due)||(!Number.isFinite(Date.parse(b.due))||new Date(b.due).toISOString().slice(0,10)!==b.due))) fail('Choose a valid deadline.');
  if(!Number.isInteger(b.minutes)||b.minutes<0||b.minutes>1440) fail('Estimated time must be between 0 and 1440 minutes.');
  const extras=Array.isArray(b.extras)?[...new Set(b.extras)]:[];
  if(extras.length>200||extras.some(x=>typeof x!=='string')) fail('Invalid students.');
  const allowed=(await db.query('SELECT DISTINCT m.student_uid FROM app.memberships m JOIN app.classes c ON c.id=m.class_id WHERE (c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1))',[uid])).rows.map(r=>r.student_uid);
  if(extras.some(x=>!allowed.includes(x))) fail('Extra students must belong to one of your classes.',403);
  if(b.links!==undefined&&!Array.isArray(b.links))fail('Invalid resources.');
  const links=(b.links||[]).map(l=>{if(!l||typeof l!=='object')fail('Invalid resource.');const url=str(l.url,2000,true);if(!/^https?:\/\//i.test(url))fail('Resource links must start with https:// or http://.');return {name:str(l.name||'Resource',100,true),url};});
  if(links.length>10) fail('Add up to ten resource links.');
  const details={instructions,due:b.due||'',minutes:b.minutes,addToTasks:b.addToTasks,graded:b.graded,scale:b.graded?b.scale:null,options,links};
  const a=edit?(await db.query('UPDATE app.assignments SET class_id=$2,title=$3,details=$4,published=$5 WHERE id=$1 RETURNING *',[edit[1],c.id,title,details,b.published])).rows[0]:(await db.query('INSERT INTO app.assignments(class_id,title,details,published) VALUES($1,$2,$3,$4) RETURNING *',[c.id,title,details,b.published])).rows[0];
  if(edit)await db.query('DELETE FROM app.assignment_extras WHERE assignment_id=$1',[a.id]);
  for(const student of extras) await db.query('INSERT INTO app.assignment_extras VALUES($1,$2)',[a.id,student]);
  await saveAttachments(db,'assignment',a.id,b.files);
  if(a.published)await notifyAssignment(db,a);
  return a;
 }
 const match=path.match(/^\/api\/school\/assignments\/([^/]+)\/(completion|results|grade|publish)$/);
 if(match) {
  const [,id,action]=match;
  const a=await accessible(db,uid,id,action!=='completion');
  if(method==='POST'&&action==='publish'){await db.query('UPDATE app.assignments SET published=true WHERE id=$1',[id]);await notifyAssignment(db,a);return {ok:true};}
  if(method==='POST'&&action==='completion') {
   if((await db.query('SELECT 1 FROM app.submission_work WHERE assignment_id=$1 AND student_uid=$2',[id,uid])).rowCount)fail('Use the submission controls to update this work.',409);
   if(a.can_teach||!a.published||typeof b.done!=='boolean') fail('Invalid completion update.');
   await db.query('INSERT INTO app.assignment_results(assignment_id,student_uid,done,completed_at) VALUES($1,$2,$3,CASE WHEN $3 THEN now() ELSE NULL END) ON CONFLICT(assignment_id,student_uid) DO UPDATE SET done=excluded.done,completed_at=excluded.completed_at',[id,uid,b.done]);return {ok:true};
  }
  const roster=(await db.query(`SELECT s.student_uid AS id,NULLIF(p.full_name,'') AS name,COALESCE(r.done,false) AS done,r.completed_at,r.grade,r.feedback,COALESCE(r.grade_revision,0) AS grade_revision,COALESCE(w.status,'not_started') AS work_status,
COALESCE((SELECT jsonb_agg(to_jsonb(attempt)||jsonb_build_object('files',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'size',octet_length(f.content))) FROM app.attachments f WHERE f.attempt_id=attempt.id),'[]'::jsonb)) ORDER BY attempt.number DESC) FROM app.submission_attempts attempt WHERE attempt.work_id=w.id),'[]'::jsonb) AS attempts FROM (SELECT student_uid FROM app.memberships WHERE class_id=$1 UNION SELECT student_uid FROM app.assignment_extras WHERE assignment_id=$2) s LEFT JOIN app.community_profiles p ON p.firebase_uid=s.student_uid LEFT JOIN app.assignment_results r ON r.student_uid=s.student_uid AND r.assignment_id=$2 LEFT JOIN app.submission_work w ON w.assignment_id=$2 AND w.student_uid=s.student_uid ORDER BY name`,[a.class_id,id])).rows;
  if(method==='GET'&&action==='results')return {students:roster};
  if(method==='POST'&&action==='grade') {
   await db.query('SELECT id FROM app.assignments WHERE id=$1 FOR UPDATE',[id]);
   if((await db.query('SELECT 1 FROM app.submission_work WHERE assignment_id=$1 AND student_uid=$2',[id,b.studentId])).rowCount)fail('Review the submitted work before returning a grade.',409);
   if(!a.details.graded||!a.details.options.includes(b.grade))fail('Choose a grade from this assignment’s scale.');
   if(!roster.some(s=>s.id===b.studentId))fail('Student is not assigned this work.',403);
   await db.query('INSERT INTO app.assignment_results(assignment_id,student_uid,grade,feedback) VALUES($1,$2,$3,$4) ON CONFLICT(assignment_id,student_uid) DO UPDATE SET grade=excluded.grade,feedback=excluded.feedback,grade_revision=app.assignment_results.grade_revision+1',[id,b.studentId,b.grade,str(b.feedback||'',3000)]);const revision=(await db.query('SELECT grade_revision FROM app.assignment_results WHERE assignment_id=$1 AND student_uid=$2',[id,b.studentId])).rows[0].grade_revision;await notify(db,b.studentId,`grade:${id}:${b.studentId}:${revision}`,id,'Grade updated: '+a.title);return {ok:true};
  }
 }
 fail('Not found.',404);
}
