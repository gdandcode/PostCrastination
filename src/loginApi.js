import {initializeApp} from 'firebase/app';
import {getAuth,inMemoryPersistence,setPersistence,signInWithEmailAndPassword,signInWithPopup,signInWithCredential,signOut,GoogleAuthProvider} from 'firebase/auth';
import {auth,firebaseApp} from './firebase';
import {communityRequest} from './communityApi';
// Validate the account before activating the main app session.
const stagingAuth=firebaseApp?getAuth(initializeApp(firebaseApp.options,'login-validation')):null;
async function stagedLogin(action,intent,activate) {
  if(!stagingAuth||!auth)throw new Error('Sign-in is unavailable.');
  await setPersistence(stagingAuth,inMemoryPersistence);
  try{
    const credential=await action(stagingAuth);
    await communityRequest(credential.user,'/api/login/check',{method:'POST',body:JSON.stringify(intent)});
    return await activate(credential);
  }finally{await signOut(stagingAuth);}
}
export function loginEmail(email,password,intent={type:'personal'}){
  return stagedLogin(staging=>signInWithEmailAndPassword(staging,email,password),intent,()=>signInWithEmailAndPassword(auth,email,password));
}
export function loginGoogle(provider){
  return stagedLogin(staging=>signInWithPopup(staging,provider),{type:'personal'},result=>{
    const credential=GoogleAuthProvider.credentialFromResult(result);
    if(!credential)throw new Error('Google sign-in could not finish. Please try again.');
    return signInWithCredential(auth,credential);
  });
}
