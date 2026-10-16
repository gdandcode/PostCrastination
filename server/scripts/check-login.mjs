import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {databaseOptions} from '../src/config.mjs';
import {ensureProfile,updateProfile} from '../src/community.mjs';
import {createApp} from '../src/app.mjs';
const db=new pg.Client(databaseOptions());await db.connect();await db.query('BEGIN');let server;
try{
 const school=(await db.query("SELECT id FROM app.schools WHERE name='Sample Academy'")).rows[0];
 const personal={uid:randomUUID(),name:'Personal login test'},student={uid:randomUUID(),name:'School student test'},teacher={uid:randomUUID(),name:'School teacher test'};
 for(const identity of [personal,student,teacher])await ensureProfile(db,identity);
 await db.query("UPDATE app.community_profiles SET school_id=$2,account_role=$3 WHERE firebase_uid=$1",[student.uid,school.id,'student']);
 await db.query("UPDATE app.community_profiles SET school_id=$2,account_role=$3 WHERE firebase_uid=$1",[teacher.uid,school.id,'teacher']);
 await assert.rejects(updateProfile(db,personal,{schoolId:school.id}),e=>e.status===400);
 const admin={uid:randomUUID(),name:'School admin test'};
 await ensureProfile(db,admin);await db.query("UPDATE app.community_profiles SET school_id=$2,account_role='sysadmin' WHERE firebase_uid=$1",[admin.uid,school.id]);
 const identities={personal,student,teacher,admin};
 server=createApp(db,async req=>{const identity=identities[req.headers.authorization];if(!identity)throw new Error('Denied');return identity;});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const check=async (who,body,status)=>{const response=await fetch(base+'/api/login/check',{method:'POST',headers:{Authorization:who,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,status);return response.json();};
 for(const role of ['student','teacher']){
  const accepted=await check(role,{type:'school',role,schoolId:school.id},200);assert.equal(accepted.accountRole,role);assert.equal(accepted.accountType,'school');
  await check(role,{type:'personal'},403);
  await check(role,{type:'school',role:role==='teacher'?'student':'teacher',schoolId:school.id},403);
  await check(role,{type:'school',role,schoolId:randomUUID()},403);
 }
 assert.equal((await check('personal',{type:'personal'},200)).accountType,'personal');
 await check('personal',{type:'school',role:'student',schoolId:school.id},403);
 await check('unknown',{type:'school',role:'teacher',schoolId:school.id},401);
 await check('personal',{type:'unknown'},400);
 assert.equal((await check('admin',{type:'school',role:'teacher',schoolId:school.id},200)).accountRole,'sysadmin');
 await check('admin',{type:'school',role:'student',schoolId:school.id},403);await check('admin',{type:'personal'},403);
 assert.equal((await ensureProfile(db,admin)).accountRole,'sysadmin');
 await assert.rejects(updateProfile(db,teacher,{accountRole:'sysadmin'}),e=>e.status===400);
 for(const identity of ['teacher','student','personal','unknown']){const response=await fetch(base+'/api/school-admin',{headers:{Authorization:identity}});assert.equal(response.status,identity==='unknown'?401:403);}
 const overview=await (await fetch(base+'/api/school-admin',{headers:{Authorization:'admin'}})).json();assert.equal(overview.school.id,school.id);assert.ok(!overview.people.some(p=>p.username===personal.name));
 const schools=await (await fetch(base+'/api/schools')).json();assert.ok(schools.schools.some(item=>item.id===school.id));assert.deepEqual(Object.keys(schools.schools[0]).sort(),['id','name']);
 console.log('PASS: real school role/membership checks, personal-login separation, denied role/school edits, authentication, school directory.');
}finally{if(server)await new Promise(r=>server.close(r));await db.query('ROLLBACK');await db.end();}
