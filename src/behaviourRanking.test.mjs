import {test} from 'node:test';import assert from 'node:assert/strict';import {rankStudents} from './behaviourRanking.mjs';
const rows=[{id:'a',name:'Alex',yearGroup:'Y9',commendations:10,demerits:3},{id:'b',name:'Jamie',yearGroup:'Y9',commendations:10,demerits:1},{id:'c',name:'Casey',yearGroup:null,commendations:5,demerits:0}];
test('ties share a rank, both totals and ascending/descending sorting work',()=>{assert.deepEqual(rankStudents(rows).map(r=>[r.id,r.rank]),[['a',1],['b',1],['c',3]]);assert.deepEqual(rankStudents(rows,{kind:'demerits',order:'asc'}).map(r=>r.id),['c','b','a']);assert.deepEqual(rankStudents(rows,{kind:'demerits',order:'desc'}).map(r=>r.count),[3,1,0]);});
test('year filters recalculate ranks and include unassigned students explicitly',()=>{assert.equal(rankStudents(rows,{yearGroup:'Y9'}).length,2);assert.deepEqual(rankStudents(rows,{yearGroup:'unassigned'}).map(r=>[r.id,r.rank]),[['c',1]]);assert.equal(rankStudents(rows,{yearGroup:'Y10'}).length,0);});

test('ratio leaderboard sorts actual ratios and handles no-demerit and no-point cases',()=>{
 const students=[...rows,{id:'d',name:'Nobody',commendations:0,demerits:0},{id:'e',name:'Tie',commendations:20,demerits:2}];
 const descending=rankStudents(students,{kind:'ratio'});assert.deepEqual(descending.map(s=>s.id),['c','b','e','a','d']);assert.equal(descending[0].count,Infinity);assert.equal(descending[1].rank,2);assert.equal(descending[2].rank,2);assert.equal(descending.at(-1).rank,null);
 const ascending=rankStudents(students,{kind:'ratio',order:'asc'});assert.deepEqual(ascending.map(s=>s.id),['a','b','e','c','d']);assert.equal(ascending.at(-1).count,null);
 assert.equal(rankStudents([{id:'zero',name:'Zero',commendations:0,demerits:2}],{kind:'ratio'})[0].count,0);
});
