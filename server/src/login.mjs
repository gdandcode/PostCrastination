import {ensureProfile} from './community.mjs';
export async function checkLogin(db,identity,body) {
  if(!body||Array.isArray(body)||!['personal','school'].includes(body.type))throw Object.assign(new Error('Choose a login type.'),{status:400});
  const profile=await ensureProfile(db,identity);
  if(body.type==='personal'&&profile.accountType==='school')throw Object.assign(new Error('This is a school account. Use the teacher or student school login.'),{status:403});
  if(body.type==='school'){
    if(profile.accountType!=='school')throw Object.assign(new Error('This is a personal account. Use personal login.'),{status:403});
    if(profile.schoolId!==body.schoolId)throw Object.assign(new Error('This account belongs to a different school.'),{status:403});
    const loginRole=profile.accountRole==='sysadmin'?'teacher':profile.accountRole;
    if(!['teacher','student'].includes(body.role)||loginRole!==body.role)throw Object.assign(new Error(`Use the ${loginRole} school login for this account.`),{status:403});
  }
  return profile;
}
