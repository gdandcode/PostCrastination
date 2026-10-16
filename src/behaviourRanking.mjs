export function rankStudents(students,{kind='commendations',yearGroup='all',order='desc'}={}){
 const score=student=>kind==='ratio'?(student.demerits?student.commendations/student.demerits:student.commendations?Infinity:null):student[kind];
 const rows=students.filter(s=>yearGroup==='all'||(s.yearGroup||'unassigned')===yearGroup).map(row=>({...row,count:score(row)})).sort((a,b)=>{
  if(a.count===null&&b.count!==null)return 1;if(b.count===null&&a.count!==null)return -1;
  const comparison=a.count===b.count?0:a.count<b.count?-1:1;
  return comparison*(order==='asc'?1:-1)||(a.name||'').localeCompare(b.name||'',undefined,{sensitivity:'base'})||a.id.localeCompare(b.id);
 });
 let rank=0,lastCount=null;return rows.map((row,index)=>{if(row.count===null)return {...row,rank:null};if(lastCount!==row.count)rank=index+1;lastCount=row.count;return {...row,rank};});
}
