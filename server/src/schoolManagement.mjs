import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {requireSchoolAdmin,featuresFor} from './features.mjs';
import {classAccess} from './discussions.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const uuid=value=>{if(typeof value!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value))fail('Invalid record.');return value;};
export async function managementRequest(db,identity,method,path,b={}){
 const uid=identity.uid;
 if(path==='/api/features'&&method==='GET')return featuresFor(db,uid);
 if(path==='/api/school-management/settings'){
  const f=await requireSchoolAdmin(db,uid);if(method==='GET')return f;
  if(method==='POST'){if(!['disabled','both','commendations','demerits','net'].includes(b.mode)||typeof b.shopEnabled!=='boolean')fail('Choose valid school settings.');await db.query('UPDATE app.schools SET behaviour_mode=$2,shop_enabled=$3 WHERE id=$1',[f.schoolId,b.mode,b.shopEnabled]);return featuresFor(db,uid);}
 }
 const match=path.match(/^\/api\/school-management\/classes\/([^/]+)\/members$/);
 if(match){const c=await classAccess(db,uid,uuid(match[1]),true);const owner=(await db.query('SELECT school_id FROM app.community_profiles WHERE firebase_uid=$1',[c.owner_uid])).rows[0];if(!owner?.school_id)fail('Class member search requires a school account.',403);
  if(method==='GET'){const people=(await db.query(`SELECT p.id,p.full_name AS name,p.display_name AS username,p.account_role AS role,EXISTS(SELECT 1 FROM app.memberships m WHERE m.class_id=$2 AND m.student_uid=p.firebase_uid) OR EXISTS(SELECT 1 FROM app.class_teachers t WHERE t.class_id=$2 AND t.teacher_uid=p.firebase_uid) OR p.firebase_uid=$3 AS joined FROM app.community_profiles p WHERE p.school_id=$1 AND p.account_role IN ('student','teacher') ORDER BY lower(p.full_name),p.id`,[owner.school_id,c.id,c.owner_uid])).rows;return {people};}
  if(method==='POST'){await db.query('SELECT id FROM app.classes WHERE id=$1 FOR UPDATE',[c.id]);const person=(await db.query('SELECT firebase_uid,account_role FROM app.community_profiles WHERE id=$1 AND school_id=$2',[uuid(b.accountId),owner.school_id])).rows[0];if(!person||!['student','teacher'].includes(person.account_role))fail('Choose a student or teacher from your school.',403);if(person.account_role==='teacher')await db.query('INSERT INTO app.class_teachers(class_id,teacher_uid) VALUES($1,$2) ON CONFLICT DO NOTHING',[c.id,person.firebase_uid]);else await db.query('INSERT INTO app.memberships(class_id,student_uid) VALUES($1,$2) ON CONFLICT DO NOTHING',[c.id,person.firebase_uid]);return {ok:true,role:person.account_role};}
 }
 fail('Not found.',404);
}
export async function createSchoolAccount(db,identity,b,provider){
 const f=await requireSchoolAdmin(db,identity.uid);if(!b||Array.isArray(b)||typeof b!=='object')fail('Invalid account request.');const request=uuid(b.requestId);
 if(!['student','teacher','sysadmin'].includes(b.role)||typeof b.username!=='string'||!b.username.trim()||b.username.length>80||typeof b.fullName!=='string'||!b.fullName.trim()||b.fullName.length>160||typeof b.email!=='string'||!/^\S+@\S+\.\S+$/.test(b.email)||b.email.length>254||typeof b.password!=='string'||b.password.length<10||b.password.length>128||!(b.yearGroup===null||typeof b.yearGroup==='string'&&/^Y([1-9]|1[0-3])$/.test(b.yearGroup))||b.role!=='student'&&b.yearGroup!==null)fail('Check name, email, role, year group and password (at least 10 characters).');
 const email=b.email.trim().toLowerCase(),hash=createHash('sha256').update(JSON.stringify([f.schoolId,b.role,b.username.trim(),b.fullName.trim(),email,b.password,b.yearGroup])).digest('hex');
 await db.query('INSERT INTO app.account_creations(request_id,creator_uid,school_id,payload_hash,email) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[request,identity.uid,f.schoolId,hash,email]);
 // Session advisory lock prevents two retries creating the same Firebase user at once.
 await db.query('SELECT pg_advisory_lock(hashtext($1))',[request]);
 try{
  const record=(await db.query('SELECT * FROM app.account_creations WHERE request_id=$1',[request])).rows[0];if(record.creator_uid!==identity.uid||record.school_id!==f.schoolId||record.payload_hash!==hash)fail('This account request was already used with different details.',409);
  let firebaseUid=record.firebase_uid;
  if(!firebaseUid){const created=await (provider||createFirebaseAccount)({email,password:b.password});firebaseUid=created.uid;await db.query('UPDATE app.account_creations SET firebase_uid=$2 WHERE request_id=$1',[request,firebaseUid]);}
  await db.query(`INSERT INTO app.community_profiles(firebase_uid,display_name,full_name,account_role,school_id,year_group,visible,onboarding_complete,study_location) VALUES($1,$2,$3,$4,$5,$6,false,true,$7) ON CONFLICT(firebase_uid) DO NOTHING`,[firebaseUid,b.username.trim(),b.fullName.trim(),b.role,f.schoolId,b.yearGroup,f.name]);
  const profile=(await db.query('SELECT id,school_id,account_role FROM app.community_profiles WHERE firebase_uid=$1',[firebaseUid])).rows[0];if(profile.school_id!==f.schoolId||profile.account_role!==b.role)fail('Account setup could not complete. Contact the administrator.',409);
  await db.query('UPDATE app.account_creations SET completed=true WHERE request_id=$1',[request]);return {id:profile.id,username:b.username.trim(),email,role:b.role};
 }finally{await db.query('SELECT pg_advisory_unlock(hashtext($1))',[request]);}
}
async function createFirebaseAccount({email,password}){
 let key=process.env.FIREBASE_WEB_API_KEY;if(!key){const env=await readFile(new URL('../../.env',import.meta.url),'utf8');key=env.match(/^VITE_FIREBASE_API_KEY\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim();}if(!key)fail('Firebase account creation is not configured.',503);
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),signal:AbortSignal.timeout(20000)});const result=await response.json();
 if(!response.ok){if(result.error?.message==='EMAIL_EXISTS')fail('This email already has an account. Choose a different email.',409);fail('Firebase could not create the account. Check the email and password or try again.',503);}return {uid:result.localId};
}
