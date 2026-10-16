import {test} from 'node:test';import assert from 'node:assert/strict';import {matchesAccount,filterAccounts} from './accountSearch.mjs';
test('name search matches typos, transpositions, accents, prefixes and reordered names',()=>{
 for(const query of ['Aelx','Morgn','Morgan Alex','alex mor','alxe'])assert.equal(matchesAccount({fullName:'Alex Morgan'},query),true,query);
 assert.equal(matchesAccount({fullName:'Łukasz Żółć'},'lukasz zolc'),true);
 assert.equal(matchesAccount({fullName:'Emma Carter'},'Daniel Foster'),false);
 assert.equal(matchesAccount({fullName:'Alex Morgan'},'alex missing'),false);
});
test('filters combine roles and year groups; teacher and class must match the same class',()=>{
 const people=[{id:1,role:'student',yearGroup:'Y9',fullName:'Alex Morgan',classes:[{id:'math',teacherId:'emma'},{id:'english',teacherId:'daniel'}]},{id:2,role:'teacher',fullName:'Emma Carter',classes:[{id:'math',teacherId:'emma'}]}];
 assert.equal(filterAccounts(people,{roles:['student'],years:['Y9'],classes:['math'],teachers:['emma']}).length,1);
 assert.equal(filterAccounts(people,{classes:['math'],teachers:['daniel']}).length,0);
 assert.equal(filterAccounts(people,{years:['unassigned']})[0].id,2);
 assert.equal(filterAccounts(people,{}).length,2);
});
