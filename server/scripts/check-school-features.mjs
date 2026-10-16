import {createApp} from '../src/app.mjs';
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import pg from 'pg';
import {localConfig} from '../src/config.mjs';import {managementRequest,createSchoolAccount} from '../src/schoolManagement.mjs';import {shopRequest,wallet} from '../src/shop.mjs';import {featuresFor} from '../src/features.mjs';import {schoolRequest} from '../src/school.mjs';import {discussionRequest} from '../src/discussions.mjs';import {behaviourRequest} from '../src/behaviour.mjs';import {gradebookRequest} from '../src/gradebook.mjs';import {visibleNotifications} from '../src/submissions.mjs';import {checkLogin} from '../src/login.mjs';
const config=localConfig();const db=new pg.Client({host:'127.0.0.1',port:config.port,user:'postgres',password:config.adminPassword,database:'postcrastination'});await db.connect();await db.query('BEGIN');
try{
 const school=(await db.query("SELECT id FROM app.schools WHERE name='Sample Academy'")).rows[0].id;const otherSchool=(await db.query('INSERT INTO app.schools(name) VALUES($1) RETURNING id',['Features other '+randomUUID()])).rows[0].id;
 const users={};for(const [name,role,sid] of [['admin','sysadmin',school],['teacher','teacher',school],['co','teacher',school],['student','student',school],['peer','student',school],['outside','student',otherSchool],['otherAdmin','sysadmin',otherSchool]]){const uid=randomUUID();users[name]={uid,id:(await db.query('INSERT INTO app.community_profiles(firebase_uid,display_name,full_name,account_role,school_id,onboarding_complete) VALUES($1,$2,$2,$3,$4,true) RETURNING id',[uid,name+' fixture',role,sid])).rows[0].id};}
 await db.query('SET LOCAL ROLE rptpc_app');
 const {admin,teacher,co,student,peer,outside,otherAdmin}=users;
 const settings=(mode,shopEnabled=true)=>managementRequest(db,admin,'POST','/api/school-management/settings',{mode,shopEnabled});await settings('both');
 await assert.rejects(managementRequest(db,student,'POST','/api/school-management/settings',{mode:'net',shopEnabled:true}),e=>e.status===403);
 const cls=await schoolRequest(db,teacher,'POST','/api/school/classes',{name:'Features class A',subject:'Maths'}),clsB=await schoolRequest(db,teacher,'POST','/api/school/classes',{name:'Features class B',subject:'Science'});
 const members='/api/school-management/classes/'+cls.id+'/members';
 await managementRequest(db,teacher,'POST',members,{accountId:co.id});for(const user of [student,peer]){await managementRequest(db,teacher,'POST',members,{accountId:user.id});await schoolRequest(db,user,'POST','/api/school/join',{code:clsB.code});}
 assert.ok((await schoolRequest(db,co,'GET','/api/school')).classes.some(c=>c.id===cls.id&&c.owned));assert.equal((await managementRequest(db,teacher,'GET',members)).people.find(p=>p.id===co.id).joined,true);
 await assert.rejects(managementRequest(db,student,'POST',members,{accountId:outside.id}),e=>e.status===404);await assert.rejects(managementRequest(db,teacher,'POST',members,{accountId:outside.id}),e=>e.status===403);
 const point=(who,user,kind)=>behaviourRequest(db,who,'POST','/api/behaviour/points',{requestId:randomUUID(),classId:cls.id,studentId:user.uid,kind,title:'Feature test',description:'Temporary fixture',date:'2026-10-09',subject:'Maths',...(kind==='demerit'?{category:'Failure to complete homework',intervention:false,interventionNotes:''}:{})});
 for(const user of [student,peer]){for(let i=0;i<20;i++)await point(i===0?co:teacher,user,'commendation');for(let i=0;i<3;i++)await point(teacher,user,'demerit');}
 await settings('commendations');await assert.rejects(point(teacher,student,'demerit'),e=>e.status===403);await settings('demerits');await assert.rejects(point(teacher,student,'commendation'),e=>e.status===403);await settings('disabled');await assert.rejects(point(teacher,student,'commendation'),e=>e.status===403);assert.equal((await behaviourRequest(db,student,'GET','/api/behaviour/student')).points.length,0);
 await settings('net');assert.equal((await wallet(db,student.uid,await featuresFor(db,student.uid))).available,17);await settings('both');assert.equal((await wallet(db,student.uid,await featuresFor(db,student.uid))).available,20);
 const createItem=async(body)=>{const result=await shopRequest(db,admin,'POST','/api/shop/admin/items',{title:'Test reward',description:'Temporary reward',cost:2,classId:null,stockScope:'school',stock:1,active:true,...body});return result.id;};
 const buy=(who,itemId,cost=2,classId=null,quantity=1,requestId=randomUUID())=>shopRequest(db,who,'POST','/api/shop/checkout',{requestId,lines:[{itemId,quantity,classId,expectedCost:cost}]});
 const limited=await createItem({cost:3});const root=randomUUID();const first=await buy(student,limited,3,null,1,root);assert.equal(first.status,'pending');assert.equal((await buy(student,limited,3,null,1,root)).id,first.id);assert.equal((await wallet(db,student.uid,await featuresFor(db,student.uid))).available,17);
 await assert.rejects(buy(peer,limited,3),e=>e.status===409);
 await shopRequest(db,admin,'POST',`/api/shop/admin/orders/${first.id}/review`,{decision:'rejected',note:'Temporary decline'});assert.equal((await wallet(db,student.uid,await featuresFor(db,student.uid))).available,20);
 const approved=await buy(peer,limited,3);await shopRequest(db,admin,'POST',`/api/shop/admin/orders/${approved.id}/review`,{decision:'approved',note:'Ready to collect'});await assert.rejects(shopRequest(db,admin,'POST',`/api/shop/admin/orders/${approved.id}/review`,{decision:'rejected'}),e=>e.status===409);
 const individual=await createItem({stockScope:'student'});await buy(student,individual);await assert.rejects(buy(student,individual),e=>e.status===409);await buy(peer,individual);
 const perClass=await createItem({stockScope:'class'});await buy(student,perClass,2,cls.id);await assert.rejects(buy(peer,perClass,2,cls.id),e=>e.status===409);await buy(peer,perClass,2,clsB.id);
 const unlimited=await createItem({stock:null,cost:1});await buy(student,unlimited,1,null,5);await assert.rejects(buy(student,unlimited,2),e=>e.status===409);
 const expensive=await createItem({cost:1000,stock:null});await assert.rejects(buy(student,expensive,1000),e=>e.status===409);
 const before=(await wallet(db,student.uid,await featuresFor(db,student.uid))).available;
 await assert.rejects(shopRequest(db,student,'POST','/api/shop/checkout',{requestId:randomUUID(),lines:[{itemId:unlimited,quantity:1,expectedCost:1},{itemId:expensive,quantity:1,expectedCost:1000}]}),e=>e.status===409);assert.equal((await wallet(db,student.uid,await featuresFor(db,student.uid))).available,before);
 await assert.rejects(shopRequest(db,otherAdmin,'POST',`/api/shop/admin/orders/${approved.id}/review`,{decision:'approved'}),e=>e.status===404);
 await assert.rejects(shopRequest(db,teacher,'GET','/api/shop'),e=>e.status===403);await assert.rejects(shopRequest(db,student,'POST','/api/shop/admin/items',{}),e=>e.status===403);
 await settings('both',false);await assert.rejects(shopRequest(db,student,'GET','/api/shop'),e=>e.status===403);await assert.rejects(buy(student,unlimited,1),e=>e.status===403);await settings('both');
 let providerCalls=0;const provider=async()=>{providerCalls++;return {uid:randomUUID()};};
 for(const role of ['student','teacher','sysadmin']){const body={requestId:randomUUID(),fullName:'Created '+role,username:'created-'+role,email:randomUUID()+'@example.com',password:'SafeInitialPassword123!',role,yearGroup:role==='student'?'Y9':null};const created=await createSchoolAccount(db,admin,body,provider);assert.equal((await createSchoolAccount(db,admin,body,provider)).id,created.id);const provision=(await db.query('SELECT firebase_uid FROM app.account_creations WHERE request_id=$1',[body.requestId])).rows[0];assert.equal((await checkLogin(db,{uid:provision.firebase_uid},{type:'school',role:role==='student'?'student':'teacher',schoolId:school})).accountRole,role);await assert.rejects(checkLogin(db,{uid:provision.firebase_uid},{type:'personal'}),e=>e.status===403);await assert.rejects(createSchoolAccount(db,student,body,provider),e=>e.status===403);}
 assert.equal(providerCalls,3);
 const task=await schoolRequest(db,co,'POST','/api/school/assignments',{classId:cls.id,title:'Linked notification task',instructions:'Test',due:'',minutes:10,addToTasks:true,graded:true,scale:'1-10',published:true,extras:[],files:[]});
 assert.ok((await visibleNotifications(db,student.uid)).some(n=>n.assignment_id===task.id&&n.message.startsWith('New assignment')));
 await gradebookRequest(db,co,'POST','/api/school/gradebook/grade',{assignmentId:task.id,studentId:student.uid,grade:'8',revision:0});assert.ok((await visibleNotifications(db,student.uid)).some(n=>n.assignment_id===task.id&&n.message.startsWith('Grade updated')));
 await discussionRequest(db,teacher,'POST',`/api/school/classes/${cls.id}/settings`,{name:cls.name,subject:'Maths',discussionsEnabled:true,studentPosts:true,studentReplies:true});const post=await discussionRequest(db,co,'POST',`/api/school/classes/${cls.id}/discussion`,{body:'Linked message',files:[]});const notification=(await visibleNotifications(db,student.uid)).find(n=>n.post_id===post.id);assert.equal(notification.class_id,cls.id);assert.equal(notification.assignment_id,null);assert.ok(!(await visibleNotifications(db,outside.uid)).some(n=>n.post_id===post.id));await discussionRequest(db,co,'POST',`/api/school/posts/${post.id}/moderate`,{action:'delete'});assert.ok(!(await visibleNotifications(db,student.uid)).some(n=>n.post_id===post.id));
 // Exercise the real HTTP dispatcher without committing temporary fixtures.
 const connection={release(){},query:async(sql,args)=>{if(sql==='BEGIN')return db.query('SAVEPOINT http_request');if(sql==='COMMIT')return db.query('RELEASE SAVEPOINT http_request');if(sql==='ROLLBACK'){await db.query('ROLLBACK TO SAVEPOINT http_request');return db.query('RELEASE SAVEPOINT http_request');}return db.query(sql,args);}};
 const http=createApp({connect:async()=>connection,query:(...args)=>db.query(...args)},async req=>{const identity=users[req.headers['x-test-user']];if(!identity)throw new Error('Unauthorized');return identity;});await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 const call=async(who,path,body)=>{const response=await fetch(`http://127.0.0.1:${http.address().port}${path}`,{headers:{'x-test-user':who,'Content-Type':'application/json'},method:body?'POST':'GET',...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};};
 try{
  assert.equal((await call('student','/api/features')).body.shopEnabled,true);
  assert.equal((await call('student','/api/school-management/settings')).status,403);
  assert.equal((await call('admin','/api/school-management/settings',{mode:'both',shopEnabled:true})).status,200);
  assert.equal((await call('teacher',members)).body.people.find(p=>p.id===co.id).joined,true);
  const item=await call('admin','/api/shop/admin/items',{title:'HTTP fixture',description:'Temporary',cost:1,classId:null,stockScope:'school',stock:null,active:true});assert.equal(item.status,200);
  assert.ok((await call('student','/api/shop')).body.items.some(i=>i.id===item.body.id));
  const order=await call('student','/api/shop/checkout',{requestId:randomUUID(),lines:[{itemId:item.body.id,quantity:1,classId:null,expectedCost:1}]});assert.equal(order.status,200);assert.equal(order.body.status,'pending');
  assert.equal((await call('admin',`/api/shop/admin/orders/${order.body.id}/review`,{decision:'rejected'})).status,200);
  assert.equal((await call('student','/api/school-management/accounts',{requestId:randomUUID()})).status,403);
  assert.equal((await call('student','/api/school/notifications')).status,200);
  assert.equal((await call('unknown','/api/shop')).status,401);
 }finally{await new Promise(resolve=>http.close(resolve));}
 console.log('PASS: school feature enforcement, net balances, shop stock scopes, reservations/refunds, approvals, checkout retries, role creation, co-teacher access and linked task/grade/discussion notifications, and HTTP routing/authentication. Fixtures rolled back.');
}finally{await db.query('ROLLBACK');await db.end();}
