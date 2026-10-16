import { saveAttachments } from './discussions.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const id=x=>{if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x||''))fail('Invalid task.');return x;};
function date(value,optional=false){if(optional&&!value)return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail('Enter a valid date.');return value;}
export async function taskRequest(db,identity,method,path,b={}){
 const uid=identity.uid;
 if(path==='/api/tasks'&&method==='GET')return {tasks:(await db.query(`SELECT t.id,t.name,to_char(t.due_date,'YYYY-MM-DD') AS "dueDate",to_char(t.date_set,'YYYY-MM-DD') AS "dateSet",t.description,t.completed,t.version,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'size',octet_length(f.content))) FROM app.attachments f WHERE f.task_id=t.id),'[]') AS files FROM app.personal_tasks t WHERE owner_uid=$1 ORDER BY created_at DESC,id`,[uid])).rows};
 const file=path.match(/^\/api\/tasks\/files\/([^/]+)$/);
 if(file&&method==='GET'){
 const f=(await db.query('SELECT f.name,f.content FROM app.attachments f JOIN app.personal_tasks t ON t.id=f.task_id WHERE f.id=$1 AND t.owner_uid=$2',[id(file[1]),uid])).rows[0];if(!f)fail('File not found.',404);return {download:true,...f};}
 const match=path.match(/^\/api\/tasks\/([^/]+)$/);
 if(method==='POST'&&(path==='/api/tasks'||match)){
 let task;
 if(match){task=(await db.query('SELECT * FROM app.personal_tasks WHERE id=$1 AND owner_uid=$2 FOR UPDATE',[id(match[1]),uid])).rows[0];if(!task)fail('Task not found.',404);if(!Number.isInteger(b.version)||b.version!==task.version)fail('This task changed. Refresh before trying again.',409);}
 if(b.action==='complete'&&task){if(typeof b.completed!=='boolean')fail('Invalid completion.');await db.query('UPDATE app.personal_tasks SET completed=$2,version=version+1 WHERE id=$1',[task.id,b.completed]);return {ok:true};}
 if(b.action==='delete'&&task){await db.query('DELETE FROM app.personal_tasks WHERE id=$1',[task.id]);return {ok:true};}
 if(b.action&&b.action!=='save')fail('Invalid action.');
 if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>160)fail('Enter a task name (up to 160 characters).');
 if(typeof b.description!=='string'||b.description.length>20000)fail('Description is too long.');
 const due=date(b.dueDate,true),set=date(b.dateSet);
 if(task)await db.query('UPDATE app.personal_tasks SET name=$2,due_date=$3,date_set=$4,description=$5,version=version+1 WHERE id=$1',[task.id,b.name.trim(),due,set,b.description]);
 else task=(await db.query('INSERT INTO app.personal_tasks(owner_uid,name,due_date,date_set,description) VALUES($1,$2,$3,$4,$5) RETURNING id',[uid,b.name.trim(),due,set,b.description])).rows[0];
 await saveAttachments(db,'task',task.id,b.files||[]);return {id:task.id};
 }
 fail('Not found.',404);
}
