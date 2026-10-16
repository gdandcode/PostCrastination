import React, { useLayoutEffect, useRef, useState } from 'react';
import emojis from './reactionEmojis.json';
import { communityRequest } from './communityApi';

export default function PostReactions({post,user,onChanged,onReact}) {
 const [panel,setPanel]=useState(null),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const popup=useRef(null),trigger=useRef(null),search=useRef(null),scroller=useRef(null);
 const [category,setCategory]=useState('Smileys & Emotion'),[limit,setLimit]=useState(120);
 const categories=[...new Set(emojis.map(e=>e[2]))];
 const term=query.trim().toLowerCase();
 const matches=emojis.filter(([emoji,keywords,group])=>term?term.split(/\s+/).every(word=>(emoji+' '+keywords).includes(word)):category==='All'||group===category);
 const reactions=post.reactions||[];
 const close=()=>{setPanel(null);trigger.current?.focus();};
 useLayoutEffect(()=>{
  if(!panel||!popup.current)return;
  const el=popup.current;
  const position=()=>{const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const width=Math.min(320,window.innerWidth-16);el.style.width=width+'px';const height=Math.min(360,window.innerHeight-16);el.style.maxHeight=height+'px';el.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-width-8))+'px';el.style.top=Math.max(8,Math.min(rect.bottom+6+height<=window.innerHeight?rect.bottom+6:rect.top-height-6,window.innerHeight-height-8))+'px';};
  el.showPopover?.();position();
  if(panel==='picker')search.current?.focus();else el.querySelector('button')?.focus();
  const outside=e=>{if(!el.contains(e.target)&&!trigger.current?.contains(e.target))setPanel(null);};
  const escape=e=>{if(e.key==='Escape')close();};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);};
 },[panel]);
 useLayoutEffect(()=>{setLimit(120);if(scroller.current)scroller.current.scrollTop=0;},[query,category]);
 async function react(emoji){if(busy)return;setBusy(true);setError('');try{
  if(onReact)await onReact(emoji,!reactions.find(r=>r.emoji===emoji)?.mine);
  else await communityRequest(user,`/api/school/posts/${post.id}/reaction`,{method:'POST',body:JSON.stringify({emoji,active:!reactions.find(r=>r.emoji===emoji)?.mine})});
  await onChanged?.();close();
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 const open=(mode,e)=>{trigger.current=e.currentTarget;setQuery('');setLimit(120);setError('');setPanel(mode);};
 const selected=reactions.find(r=>r.emoji===panel);
 return <div className="post-reactions" aria-label="Message reactions">
  {reactions.map(r=><span className={'reaction-chip'+(r.mine?' reacted':'')} key={r.emoji}>
   <button type="button" aria-pressed={r.mine} disabled={busy} title={r.people.map(p=>p.name+(p.mine?' (you)':'')).join(', ')} aria-label={`${r.mine?'Remove':'Add'} ${r.emoji} reaction`} onClick={()=>react(r.emoji)}>{r.emoji}</button>
   <button type="button" aria-label={`See who reacted ${r.emoji}: ${r.count} ${r.count===1?'person':'people'}`} onClick={e=>open(r.emoji,e)}>{r.count}</button>
  </span>)}
  <button type="button" className="reaction-add" aria-label="Add emoji reaction" title="Add emoji reaction" onClick={e=>open('picker',e)}>＋</button>
  {error&&!panel&&<p role="alert">{error}</p>}
  {panel&&<div ref={popup} popover="auto" role="dialog" className="reaction-popover" aria-label={panel==='picker'?'Choose an emoji reaction':'People who reacted'} onToggle={e=>{if(e.newState==='closed')setPanel(null);}}>
   <header><h3>{panel==='picker'?'Reactions':`${panel} Reactions`}</h3><button type="button" className="reaction-close" aria-label="Close reactions" onClick={close}>×</button></header>
   {panel==='picker'?<><label className="reaction-search"><span className="sr-only">Search emoji</span><input ref={search} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search all emoji…"/></label><label className="reaction-category"><span className="sr-only">Emoji category</span><select value={category} onChange={e=>setCategory(e.target.value)} disabled={!!term}><option>All</option>{categories.map(c=><option key={c}>{c}</option>)}</select><small>{matches.length} emoji</small></label><div ref={scroller} className="reaction-results" onScroll={e=>{const el=e.currentTarget;if(el.scrollHeight-el.scrollTop-el.clientHeight<80)setLimit(n=>Math.min(n+120,matches.length));}}><div className="reaction-emoji-grid">{matches.slice(0,limit).map(([emoji,keywords])=><button type="button" key={emoji} disabled={busy} aria-label={keywords.trim()} aria-pressed={!!reactions.find(r=>r.emoji===emoji)?.mine} title={keywords.trim()} onClick={()=>react(emoji)}>{emoji}</button>)}</div>{matches.length>limit&&<button className="school-text-button" onClick={()=>setLimit(n=>n+120)}>Show more emoji</button>}{!matches.length&&<p>No emoji found. Try another search.</p>}</div></>:<ul className="reaction-results">{selected?.people.map((p,i)=><li key={p.id||i}>{p.name}{p.mine?' (you)':''}</li>)||<li>No reactions yet.</li>}</ul>}
   {busy&&<p role="status">Saving…</p>}{error&&<p role="alert">{error}</p>}
  </div>}
 </div>;
}
