export function isSchoolEndpoint(path='') {
  return path==='/api/school'||path.startsWith('/api/school/')||path==='/api/school-admin'||path.startsWith('/api/school-admin/')||path.startsWith('/api/school-management/')||path==='/api/features'||path==='/api/resources'||path.startsWith('/api/resources/')||path==='/api/shop'||path.startsWith('/api/shop/')||path.startsWith('/api/behaviour/');
}

export async function requireSchoolAccount(db,identity) {
  const {rows}=await db.query('SELECT school_id,account_role FROM app.community_profiles WHERE firebase_uid=$1',[identity.uid]);
  const account=rows[0];
  if(!account?.school_id||!['student','teacher','sysadmin'].includes(account.account_role)) {
    throw Object.assign(new Error('School features require a school account. Please use school login.'),{status:403});
  }
  return account;
}
