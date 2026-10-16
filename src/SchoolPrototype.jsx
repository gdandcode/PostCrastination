import React, { useEffect, useState } from 'react';
import {loginEmail} from './loginApi';
export { TeacherDashboard, StudentSchoolSpace } from './SchoolSpaces';
const SCHOOL = 'Sample Academy';
export function SchoolEntry({onPersonal}) {
  const [role,setRole]=useState(''),[school,setSchool]=useState(null),[query,setQuery]=useState('');
  const [schools,setSchools]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[schoolLoading,setSchoolLoading]=useState(true),[reload,setReload]=useState(0);
  useEffect(()=>{let active=true;setSchoolLoading(true);setError('');fetch('/api/schools',{signal:AbortSignal.timeout(10000)}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);if(active)setSchools(data.schools);}).catch(e=>{if(active)setError(e.message||'Schools could not load.');}).finally(()=>{if(active)setSchoolLoading(false);});return()=>{active=false;};},[reload]);
  const step=!role?1:!school?2:3;
  async function submit(event){
    event.preventDefault();setLoading(true);setError('');
    let email=identifier.trim();
    if(school.name==='Sample Academy'&&/^sample\.(student|teacher|admin)\d{2}$/i.test(email))email=email.toLowerCase()+'@postcrastination.example.com';
    try{await loginEmail(email,password,{type:'school',schoolId:school.id,role});}
    catch(e){setError(e.code?.startsWith('auth/')?'Could not sign in. Check your email or username and password.':e.message||'Could not sign in.');}
    finally{setLoading(false);}
  }
  return <section className="school-entry school-page">
    <div className="school-entry-heading"><p className="school-eyebrow">Welcome to Postcrastination</p><h1>{step===1?'Your school day, made simpler.':step===2?'Find your school':`Welcome to ${school.name}`}</h1><p className="school-muted">{step===1?'Choose your role to find the right workspace.':step===2?'Choose the school your account belongs to.':`Sign in with your ${role} school account.`}</p></div>
    <ol className="school-steps" aria-label="Sign-in steps">{['Your role','Your school','Log in'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined}><span>{i+1}</span>{label}</li>)}</ol>
    <div className="workspace-card school-entry-card">
      {step===1&&<><h2>I’m a…</h2><div className="school-role-grid">{[['student','Student','Your assignments, classes and study tools.'],['teacher','Teacher','Set work, manage classes and give feedback.']].map(([id,label,description])=><button key={id} className="school-role" onClick={()=>{setRole(id);setError('');}}><span className="school-role-symbol" aria-hidden="true">{id==='student'?'S':'T'}</span><strong>{label}</strong><span className="school-muted">{description}</span><span className="school-role-link">Continue as {label.toLowerCase()} →</span></button>)}</div></>}
      {step===2&&<><label className="school-field">School name<input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search for your school"/></label>{schoolLoading?<p role="status">Loading schools…</p>:schools.filter(item=>item.name.toLowerCase().includes(query.trim().toLowerCase())).map(item=><button key={item.id} className="school-search-result" onClick={()=>{setSchool(item);setError('');}}><span><strong>{item.name}</strong><small>School account login</small></span><span aria-hidden="true">→</span></button>)}{!schoolLoading&&!schools.some(item=>item.name.toLowerCase().includes(query.trim().toLowerCase()))&&<p className="school-muted">No matching school. Ask your school administrator if your school is registered.</p>}<button className="workspace-secondary" onClick={()=>setRole('')}>Back to roles</button>{!schoolLoading&&error&&<button className="workspace-secondary" onClick={()=>setReload(value=>value+1)}>Try again</button>}</>}
      {step===3&&<form onSubmit={submit}><label className="school-field">School email{school.name==='Sample Academy'?' or sample username':''}<input autoFocus required autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder={school.name==='Sample Academy'?`sample.${role}01`:'Your school email'}/></label><label className="school-field">Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="submit" className="workspace-primary school-full" disabled={loading}>{loading?'Signing in…':`Sign in as ${role}`}</button><div className="school-inline"><button type="button" disabled={loading} className="workspace-secondary" onClick={()=>{setSchool(null);setPassword('');setError('');}}>Change school</button><button type="button" disabled={loading} className="workspace-secondary" onClick={()=>{setRole('');setSchool(null);setPassword('');setError('');}}>Change role</button></div></form>}
      {error&&<p role="alert">{error}</p>}
    </div><button className="school-text-button" disabled={loading} onClick={onPersonal}>Use a personal account instead</button>
  </section>;
}
export function SchoolDemoNav({studentModeControls,role,onHome,onSwitch,onAppearance}) {
  return <header className="school-topbar"><button className="school-brand" onClick={onHome}><span className="brand-mark" aria-hidden="true">P</span><span><strong>Postcrastination</strong><small>{SCHOOL}</small></span></button><div className="school-inline school-account-controls">{studentModeControls}<span className="school-badge">{role==='teacher'?'Teacher':'Student'} demo</span><button className="workspace-secondary" onClick={onSwitch}>Switch role / log out</button></div></header>;
}
