import { schoolRequest, accessible } from './school.mjs';
import { submissionRequest, notify } from './submissions.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function gradebookRequest(db,identity,method,path,b={}){
 const uid=identity.uid;
 if(method==='GET'&&path==='/api/school/gradebook'){
  const classes=(await db.query('SELECT c.id,c.name FROM app.classes c WHERE (c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1)) ORDER BY name',[uid])).rows;
  const assignments=(await db.query('SELECT a.id,a.class_id,a.title,a.details,a.published FROM app.assignments a JOIN app.classes c ON c.id=a.class_id WHERE (c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1)) ORDER BY a.created_at,a.id',[uid])).rows;
  const names=(await db.query(`SELECT DISTINCT p.firebase_uid AS id,p.full_name FROM app.community_profiles p WHERE EXISTS(SELECT 1 FROM app.memberships m JOIN app.classes c ON c.id=m.class_id WHERE m.student_uid=p.firebase_uid AND (c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1))) OR EXISTS(SELECT 1 FROM app.assignment_extras e JOIN app.assignments a ON a.id=e.assignment_id JOIN app.classes c ON c.id=a.class_id WHERE e.student_uid=p.firebase_uid AND (c.owner_uid=$1 OR EXISTS(SELECT 1 FROM app.class_teachers ct WHERE ct.class_id=c.id AND ct.teacher_uid=$1)))`,[uid])).rows;
  const students=new Map(names.map(s=>[s.id,{...s,cells:{}}]));
  for(const a of assignments){
   const roster=(await schoolRequest(db,identity,'GET',`/api/school/assignments/${a.id}/results`)).students;
   for(const s of roster){if(!students.has(s.id))students.set(s.id,{id:s.id,full_name:'',cells:{}});students.get(s.id).cells[a.id]={grade:s.grade,status:s.work_status,revision:s.grade_revision};}
  }
  return {classes,assignments,students:[...students.values()].sort((a,b)=>a.full_name.localeCompare(b.full_name)||a.id.localeCompare(b.id))};
 }
 if(method==='POST'&&path==='/api/school/gradebook/grade'){
  const a=await accessible(db,uid,b.assignmentId,true);
  if(!a.published)fail('Publish the assignment before entering grades.');
  if(!a.details.graded||!a.details.options.includes(b.grade))fail('Choose a grade from this task’s grading scale.');
  if(typeof b.studentId!=='string'||!Number.isInteger(b.revision)||b.revision<0)fail('Invalid grade entry.');
  // Serialize gradebook edits and first-time submissions on the assignment.
  await db.query('SELECT id FROM app.assignments WHERE id=$1 FOR UPDATE',[a.id]);
  const roster=(await schoolRequest(db,identity,'GET',`/api/school/assignments/${a.id}/results`)).students;
  if(!roster.some(s=>s.id===b.studentId))fail('This student is not assigned this task.',403);
  const w=(await db.query('SELECT * FROM app.submission_work WHERE assignment_id=$1 AND student_uid=$2 FOR UPDATE',[a.id,b.studentId])).rows[0];
  await db.query('INSERT INTO app.assignment_results(assignment_id,student_uid) VALUES($1,$2) ON CONFLICT DO NOTHING',[a.id,b.studentId]);
  const result=(await db.query('SELECT * FROM app.assignment_results WHERE assignment_id=$1 AND student_uid=$2 FOR UPDATE',[a.id,b.studentId])).rows[0];
  if(result.grade_revision!==b.revision)fail('This grade changed in another tab. Refresh the gradebook before saving.',409);
  if(w?.status==='submitted'){
   const last=(await db.query('SELECT * FROM app.submission_attempts WHERE work_id=$1 ORDER BY number DESC LIMIT 1',[w.id])).rows[0];
   await submissionRequest(db,identity,'POST',`/api/school/assignments/${a.id}/review-work`,{studentId:b.studentId,attemptId:last.id,action:'returned',grade:b.grade,feedback:last.feedback||''});
  }else{
   await db.query('UPDATE app.assignment_results SET grade=$3,grade_revision=grade_revision+1 WHERE assignment_id=$1 AND student_uid=$2',[a.id,b.studentId,b.grade]);
   if(w?.status==='returned')await db.query('UPDATE app.submission_attempts SET grade=$2 WHERE id=(SELECT id FROM app.submission_attempts WHERE work_id=$1 ORDER BY number DESC LIMIT 1)',[w.id,b.grade]);
  }
  const saved=(await db.query('SELECT grade,grade_revision FROM app.assignment_results WHERE assignment_id=$1 AND student_uid=$2',[a.id,b.studentId])).rows[0];
  await notify(db,b.studentId,`grade:${a.id}:${b.studentId}:${saved.grade_revision}`,a.id,'Grade updated: '+a.title);
  return saved;
 }
 fail('Not found.',404);
}
