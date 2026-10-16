import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import pg from 'pg';import {localConfig} from '../src/config.mjs';import {createApp} from '../src/app.mjs';
const config=localConfig();const db=new pg.Client({host:'127.0.0.1',port:config.port,user:'postgres',password:config.adminPassword,database:'postcrastination'});await db.connect();await db.query('BEGIN');let server;
try{
 const school=(await db.query("SELECT id FROM app.schools WHERE name='Sample Academy'")).rows[0].id;
 const otherSchool=(await db.query('INSERT INTO app.schools(name) VALUES($1) RETURNING id',['Other test school '+randomUUID()])).rows[0].id;
 const actors={};for(const [name,role,sid] of [['admin','sysadmin',school],['teacher','teacher',school],['student','student',school],['other','student',otherSchool],['otherTeacher','teacher',otherSchool]]){const uid=randomUUID();const p=(await db.query(`INSERT INTO app.community_profiles(firebase_uid,display_name,full_name,account_role,school_id,onboarding_complete) VALUES($1,$2,$2,$3,$4,true) RETURNING id`,[uid,name+' test',role,sid])).rows[0];actors[name]={uid,id:p.id};}
 const classId=(await db.query("INSERT INTO app.classes(owner_uid,name,subject,code) VALUES($1,'Admin test Maths','Maths',$2) RETURNING id",[actors.teacher.uid,randomUUID()])).rows[0].id;
 const foreignClass=(await db.query("INSERT INTO app.classes(owner_uid,name,subject,code) VALUES($1,'Other school class','History',$2) RETURNING id",[actors.otherTeacher.uid,randomUUID()])).rows[0].id;
 await db.query('INSERT INTO app.memberships(class_id,student_uid) VALUES($1,$2),($3,$2)',[classId,actors.student.uid,foreignClass]);
 const task=(await db.query("INSERT INTO app.assignments(class_id,title,details,published) VALUES($1,'Graded test',$2,true) RETURNING id",[classId,{graded:true,scale:'1-10',options:['8'],due:'2020-01-01'}])).rows[0].id;
 await db.query("INSERT INTO app.assignments(class_id,title,details,published) VALUES($1,'Pending task',$2,true),($3,'Hidden foreign task',$2,true)",[classId,{graded:false,due:'2020-01-01'},foreignClass]);
 await db.query("INSERT INTO app.assignment_results(assignment_id,student_uid,done,grade) VALUES($1,$2,true,'8')",[task,actors.student.uid]);
 for(const [kind,intervention] of [['commendation',false],['commendation',false],['demerit',true]])await db.query(`INSERT INTO app.behaviour_points(class_id,teacher_uid,student_uid,kind,title,description,point_date,subject,category,intervention,intervention_notes,request_id,payload_hash) VALUES($1,$2,$3,$4,'Test record','Description','2026-01-01','Maths',$5,$6,$7,$8,'test')`,[classId,actors.teacher.uid,actors.student.uid,kind,kind==='demerit'?'Failure to complete homework':null,intervention,intervention?'Teacher discussion':'',randomUUID()]);
 await db.query(`INSERT INTO app.behaviour_points(class_id,teacher_uid,student_uid,kind,title,description,point_date,subject,category,request_id,payload_hash) VALUES($1,$2,$3,'demerit','Foreign point','Do not expose','2026-01-01','History','Failure to follow instructions',$4,'foreign')`,[foreignClass,actors.otherTeacher.uid,actors.student.uid,randomUUID()]);
 await db.query('SET LOCAL ROLE rptpc_app');
 const wrapper={query:(...args)=>db.query(...args),connect:async()=>({query:(sql,args)=>db.query(sql==='BEGIN'?'SAVEPOINT leaderboard_test':sql==='COMMIT'?'RELEASE SAVEPOINT leaderboard_test':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT leaderboard_test':sql,args),release(){}})};
 server=createApp(wrapper,async req=>{const actor=actors[req.headers.authorization];if(!actor)throw new Error('Denied');return actor;});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(path,who='admin',method='GET',body)=>{const r=await fetch(base+path,{method,headers:{Authorization:who,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
 const directory=(await request('/api/school-admin')).data;
 assert.ok(!directory.people.some(p=>p.id===actors.other.id));assert.ok(!directory.classes.some(c=>c.id===foreignClass));assert.ok(directory.people.every(p=>!('firebase_uid' in p)));
 const student=directory.people.find(p=>p.id===actors.student.id);assert.deepEqual(student.classes.map(c=>c.id),[classId]);assert.equal(student.classes[0].teacherId,actors.teacher.id);
 const path='/api/school-admin/accounts/'+actors.student.id;
 const detail=(await request(path)).data;assert.equal(detail.stats.commendations,2);assert.equal(detail.stats.demerits,1);assert.equal(detail.stats.interventions,1);assert.equal(detail.stats.commendationsPerDemerit,2);assert.equal(detail.stats.assignments,2);assert.equal(detail.stats.graded,1);assert.equal(detail.stats.completed,1);assert.equal(detail.stats.overdue,1);assert.equal(detail.stats.completionPercentage,50);assert.equal(detail.assignments.find(a=>a.id===task).grade,'8');assert.equal(detail.points.find(p=>p.intervention).interventionNotes,'Teacher discussion');
 const updated=await request(path,'admin','PATCH',{yearGroup:'Y9'});assert.equal(updated.status,200);assert.equal(updated.data.account.yearGroup,'Y9');assert.equal((await request('/api/school-admin')).data.people.find(p=>p.id===actors.student.id).yearGroup,'Y9');
 for(const body of [{yearGroup:'Y99'},{yearGroup:'Y9',role:'sysadmin'}])assert.equal((await request(path,'admin','PATCH',body)).status,400);
 assert.equal((await request('/api/school-admin/accounts/'+actors.teacher.id,'admin','PATCH',{yearGroup:'Y9'})).status,400);
 const teacher=(await request('/api/school-admin/accounts/'+actors.teacher.id)).data;assert.equal(teacher.stats.commendations,2);assert.equal(teacher.stats.demerits,1);assert.equal(teacher.stats.gradesGiven,1);assert.equal(teacher.stats.students,1);
 for(const who of ['teacher','student']){assert.equal((await request(path,who)).status,403);assert.equal((await request(path,who,'PATCH',{yearGroup:'Y9'})).status,403);}
 assert.equal((await request('/api/school-admin/accounts/'+actors.other.id)).status,404);assert.equal((await request(path,'unknown')).status,401);
 const leaderboard=await request('/api/behaviour/leaderboard','student');assert.equal(leaderboard.status,200);
 const self=leaderboard.data.students.find(p=>p.id===actors.student.id);assert.equal(self.commendations,2);assert.equal(self.demerits,1);assert.equal(self.yearGroup,'Y9');assert.equal(self.isYou,true);
 assert.ok(!leaderboard.data.students.some(p=>p.id===actors.other.id));assert.ok(!leaderboard.data.students.some(p=>p.id===actors.teacher.id));
 assert.deepEqual(Object.keys(self).sort(),['commendations','demerits','id','isYou','name','yearGroup']);
 assert.equal((await request('/api/behaviour/leaderboard','teacher')).status,403);assert.equal((await request('/api/behaviour/leaderboard','admin')).status,403);assert.equal((await request('/api/behaviour/leaderboard','unknown')).status,401);
 const otherBoard=await request('/api/behaviour/leaderboard','other');assert.equal(otherBoard.status,200);assert.ok(!otherBoard.data.students.some(p=>p.id===actors.student.id));
 console.log('PASS: account directory relationships, student/teacher statistics, grades, year groups, runtime permissions, school-isolated student leaderboards and totals-only responses.');
}finally{if(server)await new Promise(r=>server.close(r));await db.query('ROLLBACK');await db.end();}
