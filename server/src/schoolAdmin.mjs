const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
async function adminSchool(db,identity){
 const profile=(await db.query('SELECT school_id,account_role FROM app.community_profiles WHERE firebase_uid=$1',[identity.uid])).rows[0];
 if(profile?.account_role!=='sysadmin'||!profile.school_id)fail('School administrator access required.',403);
 return profile.school_id;
}
export async function schoolAdminOverview(db,identity){
 const schoolId=await adminSchool(db,identity);
 const school=(await db.query('SELECT id,name FROM app.schools WHERE id=$1',[schoolId])).rows[0];
 const people=(await db.query(`SELECT id,firebase_uid,display_name AS username,full_name AS "fullName",account_role AS role,year_group AS "yearGroup" FROM app.community_profiles WHERE school_id=$1 ORDER BY lower(COALESCE(NULLIF(full_name,''),display_name)),id`,[schoolId])).rows;
 const classes=(await db.query(`SELECT c.id,c.name,c.subject,c.owner_uid,p.id AS "teacherId",p.full_name AS teacher,(SELECT count(*)::int FROM app.memberships m WHERE m.class_id=c.id) AS students FROM app.classes c JOIN app.community_profiles p ON p.firebase_uid=c.owner_uid WHERE p.school_id=$1 ORDER BY c.name`,[schoolId])).rows;
 const memberships=(await db.query('SELECT m.student_uid,m.class_id FROM app.memberships m JOIN app.classes c ON c.id=m.class_id JOIN app.community_profiles p ON p.firebase_uid=c.owner_uid WHERE p.school_id=$1',[schoolId])).rows;
 return {school,people:people.map(({firebase_uid,...p})=>({...p,classes:classes.filter(c=>c.owner_uid===firebase_uid||memberships.some(m=>m.student_uid===firebase_uid&&m.class_id===c.id)).map(({id,name,teacherId,teacher})=>({id,name,teacherId,teacher}))})),classes:classes.map(({owner_uid,...c})=>c)};
}
export async function schoolAdminAccount(db,identity,id,changes){
 const schoolId=await adminSchool(db,identity);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))fail('Account not found.',404);
 let account=(await db.query('SELECT id,firebase_uid,display_name AS username,full_name AS "fullName",account_role AS role,year_group AS "yearGroup",created_at AS "createdAt" FROM app.community_profiles WHERE id=$1 AND school_id=$2',[id,schoolId])).rows[0];
 if(!account)fail('Account not found.',404);
 if(changes!==undefined){
  if(!changes||Array.isArray(changes)||Object.keys(changes).length!==1||!Object.hasOwn(changes,'yearGroup')||account.role!=='student'||!(changes.yearGroup===null||typeof changes.yearGroup==='string'&&/^Y([1-9]|1[0-3])$/.test(changes.yearGroup)))fail('Choose a valid student year group.');
  await db.query('UPDATE app.community_profiles SET year_group=$2 WHERE id=$1 AND school_id=$3',[id,changes.yearGroup,schoolId]);account.yearGroup=changes.yearGroup;
 }
 const uid=account.firebase_uid;const teacher=account.role==='teacher';
 const directory=await schoolAdminOverview(db,identity);const classes=directory.people.find(p=>p.id===id).classes;
 const points=(await db.query(`SELECT b.id,b.kind,b.title,b.description,b.point_date AS date,b.subject,b.category,b.intervention,b.intervention_notes AS "interventionNotes",p.full_name AS "studentName",t.full_name AS "teacherName",c.name AS "className" FROM app.behaviour_points b JOIN app.classes c ON c.id=b.class_id JOIN app.community_profiles owner ON owner.firebase_uid=c.owner_uid LEFT JOIN app.community_profiles p ON p.firebase_uid=b.student_uid LEFT JOIN app.community_profiles t ON t.firebase_uid=b.teacher_uid WHERE owner.school_id=$1 AND ${teacher?'b.teacher_uid':'b.student_uid'}=$2 ORDER BY b.point_date DESC,b.created_at DESC`,[schoolId,uid])).rows;
 const assignments=(await db.query(`SELECT a.id,a.title,a.details,a.published,c.name AS "className",p.full_name AS "teacherName",r.grade,r.feedback,COALESCE(r.done,false) AS done,COALESCE(w.status,'not_started') AS status FROM app.assignments a JOIN app.classes c ON c.id=a.class_id JOIN app.community_profiles p ON p.firebase_uid=c.owner_uid LEFT JOIN app.assignment_results r ON r.assignment_id=a.id AND r.student_uid=$2 LEFT JOIN app.submission_work w ON w.assignment_id=a.id AND w.student_uid=$2 WHERE p.school_id=$1 AND ${teacher?'c.owner_uid=$2':`a.published AND (EXISTS(SELECT 1 FROM app.memberships m WHERE m.class_id=c.id AND m.student_uid=$2) OR EXISTS(SELECT 1 FROM app.assignment_extras e WHERE e.assignment_id=a.id AND e.student_uid=$2))`} ORDER BY a.created_at DESC`,[schoolId,uid])).rows;
 const commendations=points.filter(p=>p.kind==='commendation').length,demerits=points.filter(p=>p.kind==='demerit').length;
 const stats={commendations,demerits,interventions:points.filter(p=>p.intervention).length,commendationsPerDemerit:demerits?Math.round(commendations/demerits*100)/100:null,commendationPercentage:points.length?Math.round(commendations/points.length*100):null,classes:classes.length,assignments:assignments.length};
 if(teacher){
  stats.students=(await db.query('SELECT count(DISTINCT m.student_uid)::int AS count FROM app.memberships m JOIN app.classes c ON c.id=m.class_id WHERE c.owner_uid=$1',[uid])).rows[0].count;
  stats.published=assignments.filter(a=>a.published).length;stats.drafts=assignments.filter(a=>!a.published).length;
  stats.gradesGiven=(await db.query("SELECT count(*)::int AS count FROM app.assignment_results r JOIN app.assignments a ON a.id=r.assignment_id JOIN app.classes c ON c.id=a.class_id WHERE c.owner_uid=$1 AND r.grade IS NOT NULL AND r.grade<>''",[uid])).rows[0].count;
 }else if(account.role==='student'){
  stats.graded=assignments.filter(a=>a.grade).length;stats.completed=assignments.filter(a=>a.done).length;stats.submitted=assignments.filter(a=>['submitted','returned','changes_requested'].includes(a.status)).length;
  stats.completionPercentage=assignments.length?Math.round(stats.completed/assignments.length*100):null;
  stats.overdue=assignments.filter(a=>!a.done&&a.details.due&&new Date(/^\d{4}-\d{2}-\d{2}$/.test(a.details.due)?a.details.due+'T23:59:59':a.details.due).getTime()<Date.now()).length;
 }
 const {firebase_uid,...safeAccount}=account;return {account:safeAccount,classes,points,assignments,stats};
}
