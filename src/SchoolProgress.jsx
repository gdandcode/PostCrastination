import React, { useState } from 'react';
import { joinClass, normalizeCode, completionRows } from './schoolModel';
export function JoinClass({data,update,viewer,onJoined}) {
 const [code,setCode]=useState('');const [message,setMessage]=useState('');
 return <form className="workspace-card school-join" onSubmit={e=>{e.preventDefault();const found=data.classes.find(c=>normalizeCode(c.code)===normalizeCode(code));const already=found&&(data.enrollments||[]).some(m=>m.classId===found.id&&m.studentId===viewer.id);if(update(d=>joinClass(d,code,viewer))){setMessage(already?'You are already in this class.':`You joined ${found.name}.`);setCode('');onJoined?.(found.id);}}}><h2>Join a class</h2><p className="school-muted school-small">Enter the code your teacher shared. This local demo accepts codes from classes created in this browser.</p><div className="school-join-fields"><label className="school-field">Class code<input required autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={64} value={code} onChange={e=>setCode(e.target.value)} placeholder="e.g. SAMPLE-BIO"/></label><button type="submit" className="workspace-primary">Join class</button></div>{message&&<p role="status">{message}</p>}</form>;
}
export function TeacherProgress({data,assignmentId}) {
 const rows=completionRows(data,assignmentId);const done=rows.filter(r=>r.done).length;
 return <section className="school-progress"><h3>Student completion · {done} marked done</h3><p className="school-muted school-small">Students report their own progress. This is not a graded submission.</p>{!rows.length?<p className="school-muted">No students have joined or reported progress yet.</p>:<ul>{rows.map(row=><li key={row.studentId}><span><strong>{row.studentName}</strong><small>{row.updatedAt?`Updated ${new Date(row.updatedAt).toLocaleString()}`:'No update yet'}</small></span><span className="school-badge">{row.done?'Marked done':'Not done yet'}</span></li>)}</ul>}</section>;
}
export function TeacherActivity({data,onOpen}) {
 const activity=[...(data.activity||[])].reverse().slice(0,6);
 return <section className="school-activity"><h2 className="school-section-title">Student updates</h2>{activity.length?activity.map(event=>{const assignment=data.assignments.find(a=>a.id===event.assignmentId);return <button key={event.id} className="school-assignment" onClick={()=>onOpen(event.assignmentId)}><span><strong>{event.studentName} {event.done?'marked work done':'marked work as not done'}</strong><small>{assignment?.title||'Assignment'} · {new Date(event.updatedAt).toLocaleString()}</small></span><span aria-hidden="true">→</span></button>;}):<p className="workspace-card school-muted">When a student marks an assignment done, their update will appear here.</p>}</section>;
}
