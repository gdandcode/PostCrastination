import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {databaseOptions} from '../src/config.mjs';
import {behaviourRequest,categories} from '../src/behaviour.mjs';
const accounts=JSON.parse(await readFile(new URL('../.local/sample-academy-accounts.json',import.meta.url),'utf8'));
const teachers=accounts.filter(a=>a.role==='teacher'),students=accounts.filter(a=>a.role==='student');
assert.equal(teachers.length,4);assert.equal(students.length,10);
const checkpoint=new URL('../.local/sample-behaviour-seed.json',import.meta.url);
let seed;try{seed=JSON.parse(await readFile(checkpoint,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;seed={version:1,anchorDate:'2026-10-09'};await writeFile(checkpoint,JSON.stringify(seed,null,2));}
function requestId(value){const bytes=createHash('sha256').update('sample-behaviour-v1:'+value).digest().subarray(0,16);bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=bytes.toString('hex');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');}
const dates=[];let day=new Date(seed.anchorDate+'T12:00:00Z');while(dates.length<25){if(![0,6].includes(day.getUTCDay()))dates.push(day.toISOString().slice(0,10));day.setUTCDate(day.getUTCDate()-1);}
const commendations=[['Excellent participation','Contributed thoughtful answers and stayed engaged throughout the lesson.'],['Supportive teamwork','Helped a classmate understand the task and worked cooperatively with the group.'],['Strong independent work','Completed the activity carefully and explained the reasoning clearly.'],['Positive improvement','Showed improvement in preparation, effort and focus during the lesson.']];
const concerns=[['Device used outside the task','Used a device for an unrelated activity during independent work.'],['Uniform requirement not met','Did not meet the agreed uniform requirement at the start of the lesson.'],['Homework not completed','The assigned homework was not ready at the start of the lesson.'],['Academic integrity reminder','Copied part of a practice response rather than completing it independently.'],['Disruption during group work','Repeatedly interrupted classmates during the group activity.'],['Instructions not followed','Did not follow the instructions for starting the classroom activity.']];
const db=new pg.Client(databaseOptions());await db.connect();await db.query('BEGIN');
try{
 const school=(await db.query("SELECT id FROM app.schools WHERE name='Sample Academy'")).rows[0];assert.ok(school);
 const requests=[];let created=0,existing=0,commendationCount=0,demeritCount=0,interventionCount=0;
 for(const [j,teacher] of teachers.entries()){
  const profile=(await db.query('SELECT account_role,school_id FROM app.community_profiles WHERE firebase_uid=$1',[teacher.uid])).rows[0];assert.equal(profile.account_role,'teacher');assert.equal(profile.school_id,school.id);
  const classInfo=(await db.query('SELECT id,subject FROM app.classes WHERE id=$1 AND owner_uid=$2',[teacher.classInfo.id,teacher.uid])).rows[0];assert.ok(classInfo,'Sample class missing');
  for(const [i,student] of students.entries()){
   const member=(await db.query('SELECT account_role,school_id FROM app.community_profiles WHERE firebase_uid=$1',[student.uid])).rows[0];assert.equal(member.account_role,'student');assert.equal(member.school_id,school.id);
   const commendationTotal=2+((i+j)%3===0?1:0),demeritTotal=1+((i+2*j)%4===0?1:0);
   for(const kind of ['commendation','demerit'])for(let k=0;k<(kind==='commendation'?commendationTotal:demeritTotal);k++){
    const template=(i+j+k)% (kind==='commendation'?commendations.length:concerns.length);const [title,description]=(kind==='commendation'?commendations:concerns)[template];
    const intervention=kind==='demerit'&&(i+j+k)%2===0;
    const body={classId:classInfo.id,studentId:student.uid,kind,title:'[Sample] '+title,description:'Fictional sample record for testing. '+description,date:dates[(i*2+j*3+k*5+(kind==='demerit'?2:0))%dates.length],subject:classInfo.subject,requestId:requestId(`${teacher.uid}:${student.uid}:${classInfo.id}:${kind}:${k}`),...(kind==='demerit'?{category:categories[template],intervention,interventionNotes:intervention?'Fictional sample intervention: a brief discussion took place after the lesson, expectations were clarified, and a follow-up check was agreed.':''}:{})};
    const before=await db.query('SELECT id FROM app.behaviour_points WHERE teacher_uid=$1 AND request_id=$2',[teacher.uid,body.requestId]);
    await behaviourRequest(db,{uid:teacher.uid},'POST','/api/behaviour/points',body);requests.push(body.requestId);if(before.rowCount)existing++;else created++;
    if(kind==='commendation')commendationCount++;else demeritCount++;if(intervention)interventionCount++;
   }
  }
 }
 const verify=(await db.query(`SELECT count(*)::int AS total,count(DISTINCT (teacher_uid,student_uid))::int AS pairs,count(DISTINCT teacher_uid)::int AS teachers,count(DISTINCT student_uid)::int AS students FROM app.behaviour_points WHERE request_id=ANY($1::uuid[])`,[requests])).rows[0];
 assert.equal(verify.total,requests.length);assert.equal(verify.pairs,40);assert.equal(verify.teachers,4);assert.equal(verify.students,10);
 await db.query('COMMIT');
 console.log(`Verified ${requests.length} sample points: ${commendationCount} commendations, ${demeritCount} demerits, ${interventionCount} interventions across all 40 teacher/student pairs. Created ${created}; already present ${existing}.`);
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}
