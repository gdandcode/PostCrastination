import React,{useEffect,useRef,useState} from 'react';
import {communityRequest} from './communityApi';
import {mountLearning} from './learningUi';
import './learning.css';
export default function LearningWorkspace({user,active=true}){
const container=useRef(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
useEffect(()=>{if(!active)return;let cancelled=false,dispose;setError('');container.current.textContent='Loading your learning packs…';const request=async(method,path,body)=>communityRequest(user,path,{method,...(body?{body:JSON.stringify(body)}:{})});
if(user)request('GET','/api/learning').then(data=>{if(!cancelled)dispose=mountLearning(container.current,{data,request})}).catch(e=>{if(!cancelled){container.current.textContent='';setError(e.message)}});
else{let data;try{data=JSON.parse(localStorage.getItem('rptpc-learning-demo')||'null')}catch{}dispose=mountLearning(container.current,{data,demo:true});}
return()=>{cancelled=true;dispose?.();};},[user?.uid,reload,active]);
return <><div ref={container} />{error&&<div className="workspace-card" role="alert"><p>{error}</p><button className="workspace-secondary" onClick={()=>setReload(n=>n+1)}>Try again</button></div>}</>;
}
