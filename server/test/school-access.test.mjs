import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../src/app.mjs';
import {requireSchoolAccount,isSchoolEndpoint} from '../src/schoolAccess.mjs';

test('school membership is required even if an old personal account has a teacher role',async()=>{
  for(const account of [undefined,{school_id:null,account_role:'student'},{school_id:null,account_role:'teacher'},{school_id:null,account_role:'sysadmin'}]) {
    await assert.rejects(requireSchoolAccount({query:async()=>({rows:account?[account]:[]})},{uid:'personal'}),{status:403});
  }
  for(const role of ['student','teacher','sysadmin']) {
    const account={school_id:'school',account_role:role};
    assert.equal(await requireSchoolAccount({query:async()=>({rows:[account]})},{uid:role}),account);
  }
});

test('personal accounts cannot read, mutate or download school data over HTTP',async()=>{
  const server=createApp({query:async()=>({rows:[{school_id:null,account_role:'student'}]}),connect:async()=>{throw Error('School handler must not run');}},async()=>({uid:'personal'}));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const url=`http://127.0.0.1:${server.address().port}`;
    for(const path of ['/api/school','/api/school/join','/api/school/classes','/api/school/assignments/example/work','/api/school/files/example','/api/school/notifications','/api/resources','/api/resources/files/example','/api/behaviour/student','/api/behaviour/points','/api/shop','/api/shop/checkout','/api/features','/api/school-admin','/api/school-admin/accounts/example','/api/school-management/accounts']) {
      for(const method of ['GET','POST','PATCH']) {
        const response=await fetch(url+path,{method,headers:{'Content-Type':'application/json'},...(method==='GET'?{}:{body:'{}'})});
        assert.equal(response.status,403,`${method} ${path}`);
      }
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('personal study, community, login and tasks remain outside the school restriction',()=>{
  for(const path of ['/api/learning','/api/learning/packs','/api/tasks','/api/tasks/example','/api/community','/api/me','/api/schools','/api/login/check']) assert.equal(isSchoolEndpoint(path),false,path);
});
