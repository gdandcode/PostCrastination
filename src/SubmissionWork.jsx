import React, { useEffect, useRef, useState } from 'react';
import { communityRequest } from './communityApi';
import { SharedFilePicker, SharedFiles, encodeFiles } from './SchoolShared';

export const workLabels={not_started:'Not started',in_progress:'In progress',submitted:'Submitted',returned:'Returned',changes_requested:'Changes requested'};
export function WorkStatus({status}){return <span className={'work-status work-status-'+(status||'not_started')}>{workLabels[status]||'Not started'}</span>;}
function Attempt({attempt:a,user}){return <div className="submission-attempt"><p><strong>Submission {a.number}</strong> · {new Date(a.submitted_at).toLocaleString()}</p>{a.answer&&<p className="assignment-instructions">{a.answer}</p>}<SharedFiles files={a.files} user={user}/>{a.review_status&&<div className="submission-feedback"><WorkStatus status={a.review_status}/>{a.grade&&<p><strong>Grade: {a.grade}</strong></p>}<p className="assignment-instructions">{a.feedback||'Your teacher returned this work without a comment.'}</p></div>}</div>;}

export function StudentSubmission({assignment,user,onChanged,requested=false}){
 const [open,setOpen]=useState(false),[visited,setVisited]=useState(false);const container=useRef(null);
 useEffect(()=>{if(open)setVisited(true);},[open]);
 useEffect(()=>{if(requested){setOpen(true);container.current?.scrollIntoView({block:'start',behavior:'auto'});}},[requested]);
 return <div className="student-submission" ref={container}>{assignment.grade&&<p><strong>Grade: {assignment.grade}</strong></p>}<div className="assignment-actions"><WorkStatus status={assignment.work_status}/><button className="workspace-secondary" onClick={()=>setOpen(!open)}>{open?'Hide work':assignment.work_status==='not_started'?'Start assignment':'Open your work'}</button></div>{visited&&<div hidden={!open}><SubmissionEditor assignment={assignment} user={user} onChanged={onChanged}/></div>}</div>;
}
function SubmissionEditor({assignment:a,user,onChanged}){
 const [work,setWork]=useState(null),[answer,setAnswer]=useState(''),[files,setFiles]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const apply=w=>{setWork(w);setAnswer(w.answer);setFiles(w.files);};
 const load=async()=>{setError('');try{apply(await communityRequest(user,`/api/school/assignments/${a.id}/work`));}catch(e){setError(e.message);}};
 useEffect(()=>{let active=true;communityRequest(user,`/api/school/assignments/${a.id}/work`).then(w=>{if(active)apply(w);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[a.id,user]);
 useEffect(()=>{if(work&&['submitted','returned','changes_requested'].includes(a.work_status))load();},[a.work_status,a.grade,a.feedback]);
 const dirty=work&&(answer!==work.answer||files.length!==work.files.length||files.some((f,i)=>f.id!==work.files[i]?.id||!f.id));
 useEffect(()=>{if(!dirty)return;const warn=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 async function save(action){if(busy)return;setBusy(true);setError('');setMessage('');try{
  const w=await communityRequest(user,`/api/school/assignments/${a.id}/work`,{method:'POST',signal:AbortSignal.timeout(90000),body:JSON.stringify({action,version:work.version,answer,files:action==='revise'?[]:await encodeFiles(files)})});
  apply(w);setMessage(action==='submit'?'Submitted. Your teacher can now review this version.':action==='revise'?'Revision opened. Your previous submission is preserved.':'Draft saved. Only you can see it.');await onChanged?.();
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 if(!work)return <div className="submission-editor">{error?<p role="alert">{error} <button className="workspace-secondary" onClick={load}>Retry</button></p>:<p role="status">Loading your work…</p>}</div>;
 const editing=['not_started','in_progress'].includes(work.status);
 return <div className="submission-editor"><h4>Your work</h4>{editing?<><p>Write an answer, attach files, or both. Save your draft before leaving this page. Your teacher sees it only after you submit.</p><fieldset disabled={busy}><label className="assignment-field">Written answer<textarea rows={6} maxLength={20000} value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Write your answer here…"/></label><SharedFilePicker files={files} onChange={setFiles}/><div className="assignment-actions"><button className="workspace-secondary" onClick={()=>save('save')}>Save draft</button><button className="workspace-primary" onClick={()=>save('submit')}>{busy?'Saving…':work.attempts.length?'Resubmit work':'Submit work'}</button></div></fieldset>{dirty&&<p className="school-small">Unsaved changes</p>}</>:<><WorkStatus status={work.status}/>{work.status==='submitted'?<p>Your submitted version is waiting for your teacher. You can revise it once it has been returned.</p>:<button className="workspace-primary" disabled={busy} onClick={()=>save('revise')}>Revise & resubmit</button>}</>}{error&&<p role="alert" className="school-live-error">{error} <button className="workspace-secondary" onClick={load}>Reload saved work (discard edits)</button></p>}{message&&<p role="status">{message}</p>}{work.attempts.length>0&&<section><h4>Submission history</h4>{work.attempts.map((attempt,i)=><details key={attempt.id} open={i===0}><summary>Version {attempt.number} · {attempt.review_status?workLabels[attempt.review_status]:'Awaiting review'}</summary><Attempt attempt={attempt} user={user}/></details>)}</section>}</div>;
}

export function SubmissionReview({student:s,assignment:a,user,mutate,onSaved}){
 const latest=s.attempts?.[0];
 return <article className="assignment-grade"><h3>{s.name||'Student'}</h3><WorkStatus status={s.work_status}/>{!latest?<p>{s.work_status==='in_progress'?'The student is working on a private draft.':'No work submitted yet.'}{s.done?' They previously marked this task as done.':''}</p>:<><Attempt attempt={latest} user={user}/>{s.work_status==='submitted'&&<ReviewForm key={latest.id} student={s} assignment={a} attempt={latest} mutate={mutate} onSaved={onSaved}/>}<details><summary>Earlier submissions ({s.attempts.length-1})</summary>{s.attempts.slice(1).map(attempt=><Attempt key={attempt.id} attempt={attempt} user={user}/>)}</details></>}</article>;
}
function ReviewForm({student:s,assignment:a,attempt,mutate,onSaved}){
 const [grade,setGrade]=useState(''),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function review(action){setBusy(true);setError('');try{await mutate(`/assignments/${a.id}/review-work`,{studentId:s.id,attemptId:attempt.id,action,grade,feedback});await onSaved();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <form onSubmit={e=>{e.preventDefault();review(e.nativeEvent.submitter?.value||'returned');}}><fieldset disabled={busy}>{a.details.graded&&<label className="assignment-field">Grade<select value={grade} onChange={e=>setGrade(e.target.value)}><option value="">Choose a grade</option>{a.details.options.map(g=><option key={g}>{g}</option>)}</select></label>}<label className="assignment-field">Feedback<textarea rows={4} maxLength={3000} value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="What went well? What should change?"/></label><p>Returning work shares your feedback{a.details.graded?' and grade':''} with this student. To request changes, explain what they should improve.</p><div className="assignment-actions"><button className="workspace-primary" value="returned">{busy?'Saving…':'Return work'}</button><button className="workspace-secondary" value="changes_requested">Request changes</button></div></fieldset>{error&&<p role="alert">{error}</p>}</form>;
}
export function SchoolNotifications({school,onOpen}){
 const items=school.data.notifications||[],unread=items.filter(n=>!n.read_at).length;
 const [error,setError]=useState('');
 async function read(id){try{await school.mutate(`/notifications/${id}/read`,{});setError('');}catch(e){setError(e.message);}}
 return <details className="workspace-card school-notifications"><summary>School notifications {unread>0&&<strong>({unread} unread)</strong>}</summary><p>New assignments, deadline reminders and returned work. Reminders update while you use the app.</p>{unread>0&&<button className="workspace-secondary" onClick={()=>read('all')}>Mark all read</button>}{!items.length&&<p>No notifications yet.</p>}<ul>{items.map(n=><li key={n.id} className={n.read_at?'':'notification-unread'}><div><strong>{n.message}</strong><small>{new Date(n.created_at).toLocaleString()}</small></div><button className="workspace-secondary" onClick={()=>{read(n.id);onOpen(n.assignment_id,n);}}>{n.post_id?'View discussion':'View assignment'}</button>{!n.read_at&&<button className="school-text-button" onClick={()=>read(n.id)}>Mark read</button>}</li>)}</ul>{error&&<p role="alert">{error}</p>}</details>;
}
