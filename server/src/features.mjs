export const allowedKinds=mode=>mode==='disabled'?[]:mode==='commendations'?['commendation']:mode==='demerits'?['demerit']:['commendation','demerit'];
export async function featuresFor(db,uid,lock=false){
 const row=(await db.query(`SELECT s.id AS "schoolId",s.name,s.behaviour_mode AS mode,s.shop_enabled AS "shopEnabled",p.account_role AS role FROM app.community_profiles p JOIN app.schools s ON s.id=p.school_id WHERE p.firebase_uid=$1 ${lock?'FOR SHARE OF s':''}`,[uid])).rows[0];
 return row?{...row,kinds:allowedKinds(row.mode)}:{schoolId:null,mode:'both',shopEnabled:false,kinds:['commendation','demerit']};
}
export async function assertPointAllowed(db,uid,classId,kind){
 const row=(await db.query('SELECT s.behaviour_mode FROM app.classes c JOIN app.community_profiles p ON p.firebase_uid=c.owner_uid JOIN app.schools s ON s.id=p.school_id WHERE c.id=$1 FOR SHARE OF s',[classId])).rows[0];
 if(row&&!allowedKinds(row.behaviour_mode).includes(kind))throw Object.assign(new Error('This type of behaviour point is disabled by your school.'),{status:403});
}
export async function requireSchoolAdmin(db,uid){const f=await featuresFor(db,uid);if(f.role!=='sysadmin'||!f.schoolId)throw Object.assign(new Error('School administrator access required.'),{status:403});return f;}
