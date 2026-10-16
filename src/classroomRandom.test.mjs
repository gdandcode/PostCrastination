import {test} from 'node:test';import assert from 'node:assert/strict';import {makeGroups,pickStudent} from './classroomRandom.mjs';
const roster=Array.from({length:10},(_,id)=>({id,name:'Student '+id}));
test('random groups include every pupil exactly once and respect the requested maximum size',()=>{
 const original=[...roster];for(const size of [1,2,3,4,10]){const groups=makeGroups(roster,size,()=>.37);assert.equal(groups.length,Math.ceil(10/size));assert.ok(groups.every(g=>g.length>0&&g.length<=size));assert.deepEqual(groups.flat().map(p=>p.id).sort((a,b)=>a-b),roster.map(p=>p.id));}assert.deepEqual(roster,original);assert.deepEqual(makeGroups(roster,3,()=>.37).map(g=>g.length),[3,3,3,1]);
});
test('invalid group sizes and empty rosters are rejected',()=>{for(const size of [0,-1,1.5,11,NaN])assert.throws(()=>makeGroups(roster,size));assert.throws(()=>makeGroups([],1));});
test('the picker can select each pupil and handles one-person or empty rosters',()=>{for(let i=0;i<10;i++)assert.equal(pickStudent(roster,()=>(i+.5)/10).id,i);assert.equal(pickStudent([roster[0]]).id,0);assert.throws(()=>pickStudent([]));});
