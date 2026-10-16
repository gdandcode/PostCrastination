import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveWorkspaceView} from './workspaceRouting.mjs';
const route = changes => resolveWorkspaceView({view:'dashboard',authReady:true,hasAccess:true,teacherLocked:false,...changes});

test('teacher, sign-out, student, sign-out, teacher navigation',()=>{
  assert.equal(route({teacherLocked:true}),'teacher');
  assert.equal(route({view:'behaviour',hasAccess:false}),'login');
  assert.equal(route({view:'login',hasAccess:false}),'login');
  assert.equal(route({}),'dashboard');
  assert.equal(route({hasAccess:false}),'login');
  assert.equal(route({view:'login',hasAccess:false}),'login');
  assert.equal(route({teacherLocked:true}),'teacher');
});
test('teacher demo behaviour sign-in remains reachable',()=>{
  assert.equal(route({view:'behaviour',teacherLocked:true}),'behaviour');
  assert.equal(route({view:'login',teacherLocked:true}),'login');
  assert.equal(route({view:'login',hasAccess:false,teacherLocked:true}),'login');
});
test('teacher lock does not override sign-out or pending account lookup',()=>{
  assert.equal(route({hasAccess:false,teacherLocked:true}),'login');
  assert.equal(route({authReady:false,teacherLocked:true}),'loading');
  for(const view of ['home','dashboard','planner'])assert.equal(route({view,teacherLocked:true}),'teacher');
  for(const view of ['teacher','gradebook','behaviour','settings'])assert.equal(route({view,teacherLocked:true}),view);
});

test('school admins get their own workspace and can sign out',()=>{assert.equal(route({sysadmin:true,teacherLocked:true,view:'teacher'}),'schooladmin');assert.equal(route({sysadmin:true,view:'login'}),'login');assert.equal(route({sysadmin:true,hasAccess:false,view:'schooladmin'}),'login');});

test('resources are protected and reachable by each workspace role',()=>{assert.equal(route({view:'resources',hasAccess:false}),'login');for(const role of [{},{teacherLocked:true},{teacherLocked:true,sysadmin:true}])assert.equal(route({view:'resources',...role}),'resources');});
