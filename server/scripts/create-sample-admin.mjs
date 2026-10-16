import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {localConfig} from '../src/config.mjs';
const state=new URL('../.local/sample-academy-accounts.json',import.meta.url);
const accounts=JSON.parse(await readFile(state,'utf8'));
let account=accounts.find(a=>a.role==='sysadmin');
if(!account){account={role:'sysadmin',username:'sample.admin01',fullName:'Alex School Administrator',email:'sample.admin01@postcrastination.example.com',password:'Pc!'+randomBytes(18).toString('base64url')+'7',status:'Pending'};accounts.push(account);await writeFile(state,JSON.stringify(accounts,null,2));}
const env=await readFile(new URL('../../.env',import.meta.url),'utf8');const key=env.match(/^VITE_FIREBASE_API_KEY\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim();if(!key)throw new Error('Firebase configuration missing');
async function firebase(method,body){const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:'+method+'?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Authentication failed');return data;}
let signed;
if(account.uid)signed=await firebase('signInWithPassword',{email:account.email,password:account.password,returnSecureToken:true});
else{try{signed=await firebase('signUp',{email:account.email,password:account.password,returnSecureToken:true});}catch(error){if(error.message!=='EMAIL_EXISTS')throw error;signed=await firebase('signInWithPassword',{email:account.email,password:account.password,returnSecureToken:true});}account.uid=signed.localId;account.status='Account created';await writeFile(state,JSON.stringify(accounts,null,2));}
await firebase('update',{idToken:signed.idToken,displayName:account.username,returnSecureToken:true});
const config=localConfig();const db=new pg.Client({host:'127.0.0.1',port:config.port,user:'postgres',password:config.adminPassword,database:'postcrastination'});await db.connect();
try{
 const school=(await db.query("SELECT id FROM app.schools WHERE name='Sample Academy'")).rows[0];if(!school)throw new Error('Sample school missing');
 await db.query(`INSERT INTO app.community_profiles(firebase_uid,display_name,full_name,visible,onboarding_complete,study_location,account_role,school_id) VALUES($1,$2,$3,false,true,'Sample Academy','sysadmin',$4) ON CONFLICT(firebase_uid) DO UPDATE SET account_role='sysadmin',school_id=$4,visible=false,full_name=$3,display_name=$2,onboarding_complete=true`,[account.uid,account.username,account.fullName,school.id]);
}finally{await db.end();}
account.status='Ready: Sample Academy school administrator';await writeFile(state,JSON.stringify(accounts,null,2));
const lines=['SAMPLE ACADEMY — TEST ACCOUNTS','Open http://localhost:5173/. Choose Teacher or Student, then Sample Academy, then sign in.','School administrators use Teacher login. School accounts cannot use personal login.','Emails are login identifiers, not mailboxes. Keep this password file private.',''];
for(const role of ['sysadmin','teacher','student']){lines.push(role==='sysadmin'?'SCHOOL ADMINISTRATOR':role.toUpperCase()+'S','');for(const a of accounts.filter(a=>a.role===role)){lines.push('Name: '+a.fullName,'Username: '+a.username,'Email to sign in: '+a.email,'Password: '+a.password,'Status: '+a.status);if(a.classInfo)lines.push('Class: '+a.classInfo.name,'Join code: '+a.classInfo.code);lines.push('');}}
await writeFile('C:/Users/YOGA/OneDrive - Nord Anglia Education/Desktop/Sample Academy Login Details.txt',lines.join('\r\n'),'utf8');
console.log('Created and saved sample.admin01. Password stored only in the desktop login file and private provisioning manifest.');
