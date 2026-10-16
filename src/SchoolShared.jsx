import PostReactions from './PostReactions';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { communityRequest } from './communityApi';

export async function encodeFiles(files) {
 return Promise.all(files.map(f=>f.id?{id:f.id}:new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not read '+f.name));
  reader.onload=()=>resolve({name:f.name,base64:String(reader.result).split(',')[1]});reader.readAsDataURL(f);
 })));
}
export function SharedFilePicker({files,onChange}) {
 const [error,setError]=useState('');
 return <div className="shared-files"><label className="assignment-field"><span>Attach files</span><input type="file" multiple onChange={e=>{
  const next=[...files,...Array.from(e.target.files||[])];e.target.value='';
  if(next.length>10||next.some(f=>!f.size||f.size>10*1024*1024)||next.reduce((sum,f)=>sum+f.size,0)>25*1024*1024){setError('Use up to 10 files, 10 MB each and 25 MB total. Empty files cannot be uploaded.');return;}
  setError('');onChange(next);
 }}/></label><p>Up to 10 files · 10 MB each · 25 MB total. Files upload when you save or send.</p>{files.map((f,i)=><div className="shared-file-row" key={f.id||i}><span>{f.name} ({Math.ceil(f.size/1024)} KB)</span><button type="button" className="workspace-secondary" onClick={()=>onChange(files.filter((_,j)=>i!==j))}>Remove <span className="sr-only">{f.name}</span></button></div>)}{error&&<p role="alert">{error}</p>}</div>;
}
export function SharedFiles({files=[],user,endpoint="/api/school/files/"}) {
 const [error,setError]=useState(''),[busy,setBusy]=useState(''),[ready,setReady]=useState(null);
 useEffect(()=>()=>{if(ready)URL.revokeObjectURL(ready.url);},[ready]);
 async function download(f){setBusy(f.id);setError('');try{
  const token=await user.getIdToken();const res=await fetch(endpoint+f.id,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(90000)});
  if(!res.ok)throw new Error((await res.json()).error||'Download failed.');
  const url=URL.createObjectURL(await res.blob());setReady({url,name:f.name});const link=document.createElement('a');link.href=url;link.download=f.name;document.body.appendChild(link);link.click();link.remove();
 }catch(e){setError(e.message);}finally{setBusy('');}}
 return <div className="shared-files">{files.map(f=><button type="button" className="school-text-button" disabled={!!busy} key={f.id} onClick={()=>download(f)}>{busy===f.id?'Downloading…':`↓ ${f.name}`} ({Math.ceil(f.size/1024)} KB)</button>)}{ready&&<p role="status">If the download did not start: <a className="school-text-button" href={ready.url} download={ready.name}>Save {ready.name}</a></p>}{error&&<p role="alert">{error}</p>}</div>;
}
export function ClassSettings({classInfo:c,mutate}) {
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <details className="class-settings"><summary>Class settings</summary><form onSubmit={async e=>{
  e.preventDefault();const f=e.currentTarget.elements;setBusy(true);setError('');
  try{await mutate(`/classes/${c.id}/settings`,{name:f.className.value,subject:f.subject.value,discussionsEnabled:f.enabled.checked,studentPosts:f.posts.checked,studentReplies:f.replies.checked});setError('Settings saved.');}catch(err){setError(err.message);}finally{setBusy(false);}
 }}><fieldset disabled={busy}><label className="assignment-field">Class name<input name="className" required maxLength={100} defaultValue={c.name}/></label><label className="assignment-field">Subject<input name="subject" maxLength={100} defaultValue={c.subject}/></label><label className="assignment-check"><input type="checkbox" name="enabled" defaultChecked={c.discussions_enabled}/>Enable class discussions</label><label className="assignment-check"><input type="checkbox" name="posts" defaultChecked={c.student_posts}/>Students can start posts</label><label className="assignment-check"><input type="checkbox" name="replies" defaultChecked={c.student_replies}/>Students can reply</label><button className="workspace-secondary">{busy?'Saving…':'Save class settings'}</button></fieldset><p role="status">{error}</p></form></details>;
}
export function SharedDiscussion({classInfo:c,user,requestedPostId}) {
 const [posts,setPosts]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[body,setBody]=useState(''),[files,setFiles]=useState([]),[reply,setReply]=useState(null);
 const openedPost=useRef(null);
 const load=useCallback(async()=>{try{const data=await communityRequest(user,`/api/school/classes/${c.id}/discussion`);setPosts(data.posts);setError('');}catch(e){setError(e.message);setPosts([]);}finally{setLoading(false);}},[user,c.id]);
 useEffect(()=>{if(!c.owned&&!c.discussions_enabled)return;let active=true;load();const t=setInterval(()=>{if(active)load();},10000);return()=>{active=false;clearInterval(t);};},[load,c.discussions_enabled,c.owned]);
 async function send(e){e?.preventDefault();if(busy||(!body.trim()&&!files.length))return;setBusy(true);setError('');try{
  await communityRequest(user,`/api/school/classes/${c.id}/discussion`,{method:'POST',signal:AbortSignal.timeout(90000),body:JSON.stringify({body,parentId:reply?.id,files:await encodeFiles(files)})});setBody('');setFiles([]);setReply(null);await load();
 }catch(err){setError(err.message);}finally{setBusy(false);}}
 async function moderate(p,action){setBusy(true);try{await communityRequest(user,`/api/school/posts/${p.id}/moderate`,{method:'POST',body:JSON.stringify({action})});await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
 const canSend=c.owned||(c.discussions_enabled&&(reply?c.student_replies&&!posts.find(p=>p.id===reply.id)?.locked:c.student_posts));
 useEffect(()=>{if(requestedPostId&&openedPost.current!==requestedPostId&&posts.some(p=>p.id===requestedPostId)){openedPost.current=requestedPostId;const element=document.getElementById("discussion-post-"+requestedPostId);element?.scrollIntoView({block:"center",behavior:"auto"});element?.focus({preventScroll:true});}},[requestedPostId,posts]);
 const renderPost=p=><article id={"discussion-post-"+p.id} tabIndex={-1} key={p.id} className="school-chat-message"><header><strong>{p.author}{p.teacher?' · Teacher':''}</strong><small> · {new Date(p.created_at).toLocaleString()}</small></header>{p.deleted?<p>Message removed by teacher.</p>:<><p className="assignment-instructions">{p.body}</p><SharedFiles files={p.files} user={user}/><PostReactions post={p} user={user} onChanged={load}/></>}<div className="assignment-actions">{!p.deleted&&<>{p.locked&&<span>Replies locked</span>}{(c.owned||c.student_replies&&!(p.parent_id?posts.find(root=>root.id===p.parent_id)?.locked:p.locked))&&<button className="workspace-secondary" onClick={()=>setReply(p.parent_id?posts.find(root=>root.id===p.parent_id):p)}>Reply</button>}</>}{c.owned&&<><button className="workspace-secondary" disabled={busy} onClick={()=>moderate(p,p.deleted?'restore':'delete')}>{p.deleted?'Restore message':p.parent_id?'Delete reply':'Delete post'}</button>{!p.parent_id&&!p.deleted&&<button className="workspace-secondary" disabled={busy} onClick={()=>moderate(p,p.locked?'unlock':'lock')}>{p.locked?'Unlock replies':'Lock replies'}</button>}</>}</div></article>;
 if(!c.discussions_enabled&&!c.owned)return <p>Discussions are turned off for this class.</p>;
 return <section className="workspace-card shared-discussion"><header><h2>{c.name} · Discussion</h2><p>{c.discussions_enabled?'Class members can read this conversation.':'Discussions are off. Only you can view and prepare posts.'}</p></header>{error&&<p role="alert" className="school-live-error">{error} <button className="workspace-secondary" onClick={load}>Retry</button></p>}<div className="school-chat-stream" aria-label="Class messages">{loading?<p>Loading discussion…</p>:!posts.length?<p>No messages yet.</p>:posts.filter(p=>!p.parent_id).map(p=><div key={p.id}>{renderPost(p)}<div className="discussion-replies">{posts.filter(r=>r.parent_id===p.id).map(renderPost)}</div></div>)}</div><form className="school-chat-composer" onSubmit={send}>{reply&&<div className="school-reply-context"><span>Replying to {reply.author}</span><button type="button" className="workspace-secondary" onClick={()=>setReply(null)}>Cancel reply</button></div>}{canSend?<fieldset disabled={busy}><div className="school-chat-inputbar"><button className="school-send" type="submit" aria-label="Send message" disabled={busy||(!body.trim()&&!files.length)}>↑</button><textarea aria-label={reply?'Write a reply':'Write a class message'} placeholder={reply?'Write a reply…':'Write a message to your class…'} maxLength={5000} value={body} onChange={e=>setBody(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&window.matchMedia('(pointer:fine)').matches){e.preventDefault();send();}}}/></div><details><summary>Attach files ({files.length})</summary><SharedFilePicker files={files} onChange={setFiles}/></details><p>{busy?'Sending…':'On a computer: Enter to send · Shift+Enter for a new line'}</p></fieldset>:<p>{c.student_replies&&!reply?'You can reply to a teacher’s post above.':'Student posting is restricted by your teacher.'}</p>}</form></section>;
}
