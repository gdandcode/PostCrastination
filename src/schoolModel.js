export const SCHOOL_KEY = 'rptpc:sample-school:v1';
export const todayPlus = days => { const d = new Date(); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const assignmentDefaults = { title:'', instructions:'', due:'', dueTime:'', priority:'Medium', estimatedMinutes:30, addToTasks:true, attachments:[], status:'draft', reviews:0 };
export const classDefaults = { name:'', subject:'', description:'', discussionsEnabled:false, studentPosts:true, studentReplies:true };
export function normalizeSchool(saved) {
  const base = saved || { classes:[{id:'biology',name:'Year 10 Biology',subject:'Biology',students:24,code:'SAMPLE-BIO',discussionsEnabled:true},{id:'maths',name:'Year 9 Maths',subject:'Mathematics',students:22,code:'SAMPLE-MATH'}], assignments:[{id:'cells',classId:'biology',title:'Cell structure and function',instructions:'Explain how three cell structures support their functions. Include a labelled diagram.',due:todayPlus(3),status:'published',reviews:2},{id:'algebra',classId:'maths',title:'Practise linear equations',instructions:'Solve five linear equations and show each step of your working.',due:todayPlus(5),status:'published'},{id:'revision',classId:'biology',title:'End-of-topic revision',due:todayPlus(7),status:'draft'}] };
  if(!Array.isArray(base.classes)||!Array.isArray(base.assignments)) throw Error('The saved school data could not be read. Your stored data has not been replaced.');
  return { ...base, classes:base.classes.map(c=>({...classDefaults,...c})), assignments:base.assignments.map(a=>({...assignmentDefaults,...a})), posts:base.posts||[], studentDone:base.studentDone||{}, enrollments:base.enrollments||[], completions:base.completions||{}, activity:base.activity||[] };
}
const requireTeacher = role => { if(role!=='teacher') throw Error('Only a teacher can make this change.'); };
export function saveClass(data, item, role) {
 requireTeacher(role); if(!item.name.trim()) throw Error('Give the class a name.');
 if(item.code&&data.classes.some(c=>c.id!==item.id&&normalizeCode(c.code)===normalizeCode(item.code))) throw Error('That class code is already in use.');
 return {...data,classes:[...data.classes.filter(c=>c.id!==item.id),{...classDefaults,...item,name:item.name.trim(),subject:item.subject.trim()}]};
}
export function saveAssignment(data,item,role) {
 requireTeacher(role); if(!item.title.trim()) throw Error('Add an assignment title.');
 if(!data.classes.some(c=>c.id===item.classId)) throw Error('Choose an existing class.');
 if(!['draft','published'].includes(item.status)) throw Error('Choose a valid publishing status.');
 const minutes=Number(item.estimatedMinutes); if(!Number.isFinite(minutes)||minutes<0||minutes>1440) throw Error('Estimated time must be between 0 and 1440 minutes.');
 return {...data,assignments:[...data.assignments.filter(a=>a.id!==item.id),{...assignmentDefaults,...item,title:item.title.trim(),estimatedMinutes:minutes}]};
}
export function schoolTasks(data, viewer=DEMO_STUDENT) {
 return data.assignments.filter(a=>a.status==='published'&&a.addToTasks&&canAccessClass(data,a.classId,viewer)&&!isAssignmentDone(data,a.id,viewer)).map(a=>({id:'school:'+a.id,schoolAssignmentId:a.id,name:a.title,dueDate:a.due,urgency:a.priority,labels:['School',data.classes.find(c=>c.id===a.classId)?.name||'Class']}));
}
export function addPost(data,post,role,viewer=DEMO_STUDENT) {
 const c=data.classes.find(c=>c.id===post.classId); if(!c?.discussionsEnabled) throw Error('Discussions are turned off for this class.');
 if(role==='student'&&!canAccessClass(data,post.classId,viewer)) throw Error('Join this class before posting.');
 if(!['student','teacher'].includes(role)) throw Error('Sign in to participate.');
 if(!post.text.trim()&&!post.attachments?.length) throw Error('Write a message or attach a file.');
 if(post.text.length>5000) throw Error('Keep messages under 5,000 characters.');
 if(role==='student' && !(post.parentId ? c.studentReplies : c.studentPosts)) throw Error(post.parentId?'Student replies are currently disabled.':'Student posts are currently disabled.');
 if(post.parentId) { const parent=data.posts.find(p=>p.id===post.parentId); if(!parent||parent.classId!==c.id||parent.parentId||parent.deleted) throw Error('This conversation is no longer available for replies.'); if(parent.locked&&role==='student') throw Error('The teacher has closed replies on this post.'); }
 return {...data,posts:[...data.posts,{...post,text:post.text.trim(),role,authorId:role==='teacher'?'demo-teacher':viewer.id,author:role==='teacher'?'Demo teacher':viewer.name,deleted:false,createdAt:Date.now()}]};
}
export function moderatePost(data,id,action,role,viewer=DEMO_STUDENT) {
 const post=data.posts.find(p=>p.id===id);if(!post)throw Error('Post not found.');
 if(role!=='teacher' && !(role==='student'&&post.authorId===viewer.id&&canAccessClass(data,post.classId,viewer)&&action==='delete')) throw Error('Only a teacher can moderate this post.');
 if(!['delete','restore','lock','unlock'].includes(action))throw Error('Unknown moderation action.');
 return {...data,posts:data.posts.map(p=>p.id===id?{...p,...(action==='delete'?{deleted:true}:action==='restore'?{deleted:false}:{locked:action==='lock'})}:p)};
}

export const DEMO_STUDENT = { id:'demo-student', name:'Demo student', demoAll:true };
export const normalizeCode = code => String(code||'').replace(/\s+/g,'').toUpperCase();
export function canAccessClass(data,classId,viewer=DEMO_STUDENT) {
 return Boolean(viewer?.id && data.classes.some(c=>c.id===classId) && (viewer.demoAll || (data.enrollments||[]).some(e=>e.classId===classId&&e.studentId===viewer.id)));
}
export function joinClass(data,code,viewer) {
 if(!viewer?.id) throw Error('Sign in before joining a class.');
 const normalized=normalizeCode(code);if(!normalized) throw Error('Enter the code from your teacher.');
 const c=data.classes.find(c=>normalizeCode(c.code)===normalized);if(!c) throw Error('No class matches that code in this local school. Check the code with your teacher.');
 if((data.enrollments||[]).some(e=>e.classId===c.id&&e.studentId===viewer.id)) return data;
 return {...data,enrollments:[...(data.enrollments||[]),{classId:c.id,studentId:viewer.id,studentName:viewer.name||'Student',joinedAt:Date.now()}]};
}
export function isAssignmentDone(data,assignmentId,viewer=DEMO_STUDENT) {
 const entry=data.completions?.[assignmentId]?.[viewer.id];
 return entry ? entry.done : viewer.id==='demo-student'&&Boolean(data.studentDone?.[assignmentId]);
}
export function recordCompletion(data,assignmentId,done,viewer=DEMO_STUDENT) {
 const a=data.assignments.find(a=>a.id===assignmentId&&a.status==='published');
 if(!a||!canAccessClass(data,a.classId,viewer)) throw Error('Join this class to update this assignment.');
 if(isAssignmentDone(data,assignmentId,viewer)===done) return data;
 const updatedAt=Date.now(); const entry={studentId:viewer.id,studentName:viewer.name||'Student',done:Boolean(done),updatedAt};
 return {...data,completions:{...(data.completions||{}),[assignmentId]:{...(data.completions?.[assignmentId]||{}),[viewer.id]:entry}},activity:[...(data.activity||[]),{id:assignmentId+':'+viewer.id+':'+updatedAt,assignmentId,classId:a.classId,...entry}].slice(-200)};
}
export function completionRows(data,assignmentId) {
 const a=data.assignments.find(a=>a.id===assignmentId);if(!a)return [];
 const rows=new Map((data.enrollments||[]).filter(e=>e.classId===a.classId).map(e=>[e.studentId,{studentId:e.studentId,studentName:e.studentName,done:false,updatedAt:null}]));
 if(data.studentDone?.[assignmentId]) rows.set('demo-student',{studentId:'demo-student',studentName:'Demo student',done:true,updatedAt:null});
 for(const entry of Object.values(data.completions?.[assignmentId]||{})) rows.set(entry.studentId,entry);
 return [...rows.values()].sort((a,b)=>a.studentName.localeCompare(b.studentName));
}
