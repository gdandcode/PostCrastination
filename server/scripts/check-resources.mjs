import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import pg from 'pg';import {localConfig} from '../src/config.mjs';import {resourceRequest} from '../src/resources.mjs';import {createApp} from '../src/app.mjs';
const config=localConfig(),db=new pg.Client({host:'127.0.0.1',port:config.port,user:'postgres',password:config.adminPassword,database:'postcrastination'});await db.connect();await db.query('BEGIN');
try{
 const sid=(await db.query("SELECT id FROM app.schools WHERE name='Sample Academy'")).rows[0].id,other=(await db.query('INSERT INTO app.schools(name) VALUES($1) RETURNING id',['Resource fixture '+randomUUID()])).rows[0].id;
 const users={};for(const [name,role,school] of [['teacher','teacher',sid],['co','teacher',sid],['student','student',sid],['peer','student',sid],['admin','sysadmin',sid],['outside','sysadmin',other]]){users[name]={uid:randomUUID()};await db.query('INSERT INTO app.community_profiles(firebase_uid,display_name,full_name,account_role,school_id) VALUES($1,$2,$2,$3,$4)',[users[name].uid,name,role,school]);}
 const cls=(await db.query('INSERT INTO app.classes(owner_uid,name,subject,code) VALUES($1,$2,$3,$4) RETURNING id',[users.teacher.uid,'Resource fixture','Maths',randomUUID()])).rows[0].id;
 await db.query('INSERT INTO app.memberships(class_id,student_uid) VALUES($1,$2)',[cls,users.student.uid]);await db.query('INSERT INTO app.class_teachers(class_id,teacher_uid) VALUES($1,$2)',[cls,users.co.uid]);await db.query('SET LOCAL ROLE rptpc_app');
 const root='/api/resources/classes/'+cls,folder=randomUUID(),subfolder=randomUUID(),file=randomUUID();const batch={entries:[{id:folder,name:'Unit 1',kind:'folder'},{id:subfolder,parentId:folder,name:'Revision',kind:'folder'},{id:file,parentId:subfolder,name:'notes.txt',kind:'file',base64:Buffer.from('Class material ✓').toString('base64')}]};
 const connection={release(){},query:async(sql,args)=>{if(sql==='BEGIN')return db.query('SAVEPOINT resource_http');if(sql==='COMMIT')return db.query('RELEASE SAVEPOINT resource_http');if(sql==='ROLLBACK'){await db.query('ROLLBACK TO SAVEPOINT resource_http');return db.query('RELEASE SAVEPOINT resource_http');}return db.query(sql,args);}};
 const app=createApp({connect:async()=>connection,query:(...args)=>db.query(...args)},async req=>{if(!users[req.headers['x-test-user']])throw new Error('No identity');return users[req.headers['x-test-user']];});await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const call=async(name,path,body,binary=false)=>{const response=await fetch(`http://127.0.0.1:${app.address().port}${path}`,{method:body?'POST':'GET',headers:{'x-test-user':name,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,headers:response.headers,body:binary?await response.text():await response.json()};};
 try{
  assert.equal((await call('teacher',root,batch)).status,200);assert.equal((await call('teacher',root,batch)).status,200);assert.equal((await call('student',root,batch)).status,403);
  const list=await call('student',root+'/folders/'+subfolder);assert.equal(list.status,200);assert.deepEqual(list.body.path.map(p=>p.name),['Unit 1','Revision']);assert.equal(list.body.entries.length,1);assert.equal(list.body.entries[0].name,'notes.txt');assert.equal(list.body.classInfo.editable,false);
  const download=await call('student','/api/resources/files/'+file,undefined,true);assert.equal(download.status,200);assert.equal(download.body,'Class material ✓');assert.match(download.headers.get('content-disposition'),/attachment/);
  for(const name of ['peer','outside']){assert.equal((await call(name,root)).status,404);assert.equal((await call(name,'/api/resources/files/'+file)).status,404);assert.ok(!(await call(name,'/api/resources')).body.classes.some(c=>c.id===cls));}
  for(const name of ['teacher','co','admin'])assert.equal((await call(name,root)).body.classInfo.editable,true);
  assert.equal((await call('admin',root+'/folders/'+folder,{entries:[{id:randomUUID(),name:'Admin note.txt',kind:'file',base64:''}]})).status,200);
  assert.equal((await call('co',root,{entries:[{id:randomUUID(),name:'Co-teacher folder',kind:'folder'}]})).status,200);
  assert.equal((await call('teacher',root,{entries:[{id:randomUUID(),name:'unit 1',kind:'folder'}]})).status,409);
  const atomic=randomUUID();assert.equal((await call('teacher',root,{entries:[{id:atomic,name:'Rollback me',kind:'folder'},{id:randomUUID(),name:'Unit 1',kind:'folder'}]})).status,409);assert.equal((await db.query('SELECT id FROM app.class_resources WHERE id=$1',[atomic])).rowCount,0);
  assert.equal((await call('teacher',root,{entries:[{id:randomUUID(),name:'../bad',kind:'folder'}]})).status,400);
  assert.equal((await call('student',root+'/folders/'+file)).status,404);assert.equal((await call('unknown','/api/resources')).status,401);
  const action=(who,id,body)=>call(who,'/api/resources/entries/'+id+'/manage',body);
  assert.equal((await action('student',file,{action:'rename',name:'Forbidden.txt'})).status,403);
  assert.equal((await action('outside',file,{action:'trash'})).status,404);
  assert.equal((await action('teacher',folder,{action:'rename',name:'Unit one'})).status,200);
  assert.equal((await action('teacher',folder,{action:'move',parentId:subfolder})).status,409);
  assert.equal((await action('co',file,{action:'move',parentId:null})).status,200);
  assert.ok((await call('student',root)).body.entries.some(e=>e.id===file));
  assert.equal((await action('teacher',file,{action:'move',parentId:subfolder})).status,200);
  assert.equal((await action('teacher',file,{action:'trash'})).status,200);
  assert.equal((await call('student','/api/resources/files/'+file)).status,404);
  assert.equal((await action('teacher',folder,{action:'trash'})).status,200);
  assert.equal((await call('student',root+'/folders/'+subfolder)).status,404);
  assert.equal((await action('teacher',file,{action:'restore'})).status,404);
  const replacement=randomUUID();assert.equal((await call('teacher',root,{entries:[{id:replacement,name:'Unit one',kind:'folder'}]})).status,200);
  assert.equal((await action('teacher',folder,{action:'restore'})).status,409);
  assert.equal((await action('teacher',replacement,{action:'rename',name:'Replacement'})).status,200);
  assert.equal((await action('admin',folder,{action:'restore'})).status,200);
  assert.equal((await call('student',root+'/folders/'+subfolder)).status,200);
  assert.equal((await call('student','/api/resources/files/'+file)).status,404);
  assert.equal((await action('teacher',file,{action:'restore'})).status,200);
  assert.equal((await call('student','/api/resources/files/'+file,undefined,true)).body,'Class material ✓');
  assert.ok((await call('teacher',root)).body.allEntries.some(e=>e.id===file));
  assert.equal((await call('student',root)).body.trash.length,0);
  console.log('PASS: resource folders, nested uploads, text files, binary downloads, atomic saves/retries, co-teacher/admin permissions, student read-only access and class isolation, rename/move cycles, recycle-bin access, name collisions and independent restoration. Fixtures rolled back.');
 }finally{await new Promise(resolve=>app.close(resolve));}
}finally{await db.query('ROLLBACK');await db.end();}
