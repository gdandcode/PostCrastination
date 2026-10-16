import React, { useEffect, useState } from 'react';
import { communityRequest, syncCommunityUser } from './communityApi';

export function CommunityAccountSync({ user }) {
  const [error,setError]=useState(false);const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    setError(false);
    if (!user?.getIdToken) return;
    const sync=()=>syncCommunityUser(user).then(()=>{if(active)setError(false);}).catch(()=>{if(active)setError(true);});
    sync();
    window.addEventListener('online',sync);
    const timer=setInterval(sync,60000);
    return ()=>{active=false;clearInterval(timer);window.removeEventListener('online',sync);};
  },[user?.uid,retry]);
  return error?<div className="community-sync-notice" role="status">Your account is signed in, but Community hasn’t synced yet. Start the backend, then <button className="school-text-button" onClick={()=>setRetry(n=>n+1)}>Retry</button>.</div>:null;
}

export default function CommunityPage({ currentUser }) {
  const [people,setPeople]=useState([]);const [me,setMe]=useState(null);const [name,setName]=useState('');
  const [page,setPage]=useState(0);const [hasMore,setHasMore]=useState(false);const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');const [retry,setRetry]=useState(0);const [saving,setSaving]=useState(false);const [notice,setNotice]=useState('');
  useEffect(()=>{
    let active=true;const abort=new AbortController();
    setPeople([]);setMe(null);setError('');
    if(!currentUser?.getIdToken)return;
    setLoading(true);
    (async()=>{
      try {
        const own=await syncCommunityUser(currentUser);
        const list=await communityRequest(currentUser,`/api/community?page=${page}`,{signal:abort.signal});
        if(active){setMe(own);setName(own.username);setPeople(list.people);setHasMore(list.hasMore);}
      }catch(e){if(active)setError(e.message || 'Could not load Community. Try again.');}
      finally{if(active)setLoading(false);}
    })();
    return ()=>{active=false;abort.abort();};
  },[currentUser?.uid,page,retry]);
  if(!currentUser?.getIdToken)return <section className="study-workspace mx-auto max-w-5xl px-6 pt-36 pb-20"><h1 className="text-3xl font-black">Community</h1><p className="mt-4">Sign in with a real account to meet other members. Demo accounts stay separate.</p></section>;
  async function save(e){
    e.preventDefault();setSaving(true);setError('');setNotice('');
    try{await syncCommunityUser(currentUser,{username:name,visible:e.currentTarget.elements.visible.checked});setNotice('Community profile saved.');setRetry(n=>n+1);}
    catch(e){setError(e.message || 'Could not save. Please try again.');}
    finally{setSaving(false);}
  }
  return <section className="study-workspace mx-auto max-w-6xl px-6 pt-36 pb-28">
    <header className="school-section-heading"><div><h1 className="text-3xl font-black">Community</h1><p className="school-muted mt-2">Meet people using Postcrastination.</p></div><button className="workspace-secondary" disabled={loading||saving} onClick={()=>setRetry(n=>n+1)}>Refresh</button></header>
    {me&&<form className="workspace-card mb-6" onSubmit={save}><h2 className="text-lg font-bold">Your Community profile</h2><p className="school-muted school-small mt-2">New accounts appear here by display name. Your email and personal details are not listed.</p><label className="school-field mt-4">Display name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80}/></label><label className="school-inline mb-4"><input key={String(me.profileVisibility)} name="visible" type="checkbox" defaultChecked={me.profileVisibility==='public'}/> Show me in Community</label><button className="workspace-primary" disabled={saving||loading}>{saving?'Saving…':'Save Community profile'}</button></form>}
    {error&&<p className="school-error" role="alert">{error} <button className="school-text-button" onClick={()=>setRetry(n=>n+1)}>Try again</button></p>}
    {notice&&<p className="school-success" role="status">{notice}</p>}
    {loading?<p role="status">Loading members…</p>:!error&&<><div className="school-class-grid">{people.map(person=><article className="workspace-card" key={person.id}><span aria-hidden="true" className="community-initial">{person.username.slice(0,1).toUpperCase()}</span><h2 className="text-xl font-bold mt-3 break-words">{person.username}{person.id===me?.id?' (you)':''}</h2><p className="school-muted mt-2">Postcrastination member</p></article>)}</div>{!people.length&&<p className="workspace-card">No visible members on this page yet.</p>}<nav aria-label="Community pages" className="school-inline mt-6"><button className="workspace-secondary" disabled={page===0} onClick={()=>setPage(n=>n-1)}>Previous</button><span>Page {page+1}</span><button className="workspace-secondary" disabled={!hasMore} onClick={()=>setPage(n=>n+1)}>Next</button></nav></>}
  </section>;
}
