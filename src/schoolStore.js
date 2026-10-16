import { useEffect, useState } from 'react';
import { SCHOOL_KEY, normalizeSchool } from './schoolModel';
const eventName='rptpc:school-change';
export function readSchool(){const text=localStorage.getItem(SCHOOL_KEY);return normalizeSchool(text?JSON.parse(text):null);}
export function useSchoolData(){
 const [error,setError]=useState('');const [data,setData]=useState(()=>{try{return readSchool();}catch{return normalizeSchool(null);}});
 useEffect(()=>{const sync=()=>{try{setData(readSchool());setError('');}catch(e){setError(e.message);}};sync();const storage=e=>{if(e.key===SCHOOL_KEY)sync();};window.addEventListener(eventName,sync);window.addEventListener('storage',storage);return()=>{window.removeEventListener(eventName,sync);window.removeEventListener('storage',storage);};},[]);
 const update=fn=>{try{const next=fn(readSchool());localStorage.setItem(SCHOOL_KEY,JSON.stringify(next));setData(next);setError('');window.dispatchEvent(new Event(eventName));return true;}catch(e){setError(e.name==='QuotaExceededError'?'Local storage is full. Your changes have not been saved.':e.message);return false;}};
 return [data,update,error];
}
const DB_NAME='rptpc-school-files';
function openDB(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function transaction(mode,operation){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('files',mode);let result;const req=operation(tx.objectStore('files'));req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error||Error('File storage failed.'));};});}
export const loadFile=id=>transaction('readonly',store=>store.get(id));
export const deleteFile=id=>transaction('readwrite',store=>store.delete(id));
export async function persistFiles(items){const saved=[];const created=[];try{for(const item of items){if(item.file){await transaction('readwrite',store=>store.put(item.file,item.id));created.push(item.id);}const {file,...metadata}=item;saved.push(metadata);}return {saved,created};}catch(e){await Promise.allSettled(created.map(deleteFile));throw Error('Could not save the attachment files. Try a smaller file or check browser storage.');}}
export async function rollbackFiles(ids){await Promise.allSettled(ids.map(deleteFile));}
