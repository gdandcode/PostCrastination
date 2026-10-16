import React, { useEffect, useRef, useState } from 'react';
import { updateProfile, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { syncCommunityUser } from './communityApi';

export default function ExternalAccountSetup({user,onComplete}) {
  const dialog=useRef(null);const [finished,setFinished]=useState(false);const [loaded,setLoaded]=useState(false);
  const [fullName,setFullName]=useState('');const [username,setUsername]=useState('');const [location,setLocation]=useState('');const [visible,setVisible]=useState(true);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    syncCommunityUser(user).then(profile=>{
      if(!active)return;
      if(profile.onboardingComplete){onComplete(profile);setFinished(true);return;}
      setFullName(profile.fullName||'');setUsername(profile.username==='Student'?'':profile.username);setLocation(profile.studyLocation||'');setVisible(profile.profileVisibility==='public');setLoaded(true);setError('');
    }).catch(()=>{if(active)setError('We couldn’t load your account setup. Start the backend, then try again.');});
    return ()=>{active=false;};
  },[user.uid,retry]);
  useEffect(()=>{if(finished)dialog.current?.close();else if(dialog.current&&!dialog.current.open)dialog.current.showModal();},[finished]);
  async function submit(e){
    e.preventDefault();setBusy(true);setError('');
    try{
      const profile=await syncCommunityUser(user,{fullName:fullName.trim(),username:username.trim(),studyLocation:location.trim(),visible,completeSetup:true});
      // PostgreSQL is authoritative. A provider display-name failure must not lose setup.
      try{await updateProfile(user,{displayName:profile.username});}catch{}
      onComplete(profile);setFinished(true);
    }catch(e){setError(e.message||'Your details could not be saved. Please try again.');}
    finally{setBusy(false);}
  }
  return <dialog ref={dialog} className="external-setup" onCancel={e=>e.preventDefault()} aria-labelledby="account-setup-title"><h1 id="account-setup-title">Make yourself at home</h1><p>Choose how you’ll appear in Postcrastination. No random characters added.</p>
    {loaded?<form onSubmit={submit}><label className="school-field">Your username<input autoFocus autoComplete="nickname" required minLength={1} maxLength={80} value={username} onChange={e=>setUsername(e.target.value)}/></label><label className="school-field">Full name for school (optional)<input autoComplete="name" maxLength={160} value={fullName} onChange={e=>setFullName(e.target.value)}/></label><p className="school-small">Shown to your teachers, not on the public Community list.</p><label className="school-field">Study location (optional)<input autoComplete="off" maxLength={120} value={location} onChange={e=>setLocation(e.target.value)} placeholder="For example, your school or city"/></label><p className="school-small">You can leave this blank. Your location is kept off the Community list.</p><label className="school-inline"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/> Show my username in Community</label><button className="workspace-primary" disabled={busy||!username.trim()}>{busy?'Saving…':'Finish setup'}</button></form>:!error&&<p role="status">Loading your account…</p>}
    {error&&<p role="alert" className="school-error">{error}{!loaded&&<button className="workspace-secondary" onClick={()=>setRetry(n=>n+1)}>Try again</button>}</p>}
    <button className="school-text-button" disabled={busy} onClick={()=>signOut(auth)}>Sign out</button>
  </dialog>;
}
