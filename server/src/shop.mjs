import {createHash} from 'node:crypto';
import {featuresFor,requireSchoolAdmin} from './features.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const uuid=value=>{if(typeof value!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value))fail('Invalid record.');return value;};
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))fail('Check the required text fields.');return value.trim();};
export async function wallet(db,uid,f){
 const row=(await db.query(`SELECT count(b.id) FILTER(WHERE b.kind='commendation' AND owner.school_id=$2)::int AS earned,count(b.id) FILTER(WHERE b.kind='demerit' AND owner.school_id=$2)::int AS demerits FROM app.behaviour_points b JOIN app.classes c ON c.id=b.class_id JOIN app.community_profiles owner ON owner.firebase_uid=c.owner_uid WHERE b.student_uid=$1`,[uid,f.schoolId])).rows[0];
 const spent=(await db.query("SELECT COALESCE(sum(total),0)::int AS n FROM app.shop_orders WHERE student_uid=$1 AND school_id=$2 AND status IN ('pending','approved')",[uid,f.schoolId])).rows[0].n;
 const earned=['both','commendations','net'].includes(f.mode)?row.earned:0;
 const score=earned-(f.mode==='net'?row.demerits:0);
 return {earned,demerits:row.demerits,score,reservedOrSpent:spent,available:Math.max(0,score-spent)};
}
async function orders(db,f,uid=null){return (await db.query(`SELECT o.id,o.status,o.total,o.review_note AS "reviewNote",o.created_at AS "createdAt",o.reviewed_at AS "reviewedAt",p.full_name AS student,p.id AS "studentId",COALESCE(jsonb_agg(jsonb_build_object('itemId',l.item_id,'title',l.title,'cost',l.cost,'quantity',l.quantity,'classId',l.class_id)) FILTER(WHERE l.id IS NOT NULL),'[]') AS lines FROM app.shop_orders o JOIN app.community_profiles p ON p.firebase_uid=o.student_uid LEFT JOIN app.shop_order_lines l ON l.order_id=o.id WHERE o.school_id=$1 ${uid?'AND o.student_uid=$2':''} GROUP BY o.id,p.id ORDER BY o.created_at DESC LIMIT 200`,uid?[f.schoolId,uid]:[f.schoolId])).rows;}
async function used(db,item,uid,classId){const args=[item.id];let filter='';if(item.stock_scope==='student'){args.push(uid);filter='AND o.student_uid=$2';}if(item.stock_scope==='class'){args.push(classId);filter='AND l.class_id=$2';}return (await db.query(`SELECT COALESCE(sum(l.quantity),0)::int AS n FROM app.shop_order_lines l JOIN app.shop_orders o ON o.id=l.order_id WHERE l.item_id=$1 AND o.status IN ('pending','approved') ${filter}`,args)).rows[0].n;}
export async function shopRequest(db,identity,method,path,b={}){
 const uid=identity.uid;const admin=path.startsWith('/api/shop/admin');const f=admin?await requireSchoolAdmin(db,uid):await featuresFor(db,uid,true);
 if(!f.schoolId||(!admin&&f.role!=='student'))fail('Use a school student account to open the shop.',403);
 const classes=(await db.query(`SELECT c.id,c.name FROM app.classes c JOIN app.community_profiles owner ON owner.firebase_uid=c.owner_uid WHERE owner.school_id=$1 ${admin?'':`AND EXISTS(SELECT 1 FROM app.memberships m WHERE m.class_id=c.id AND m.student_uid=$2)`} ORDER BY c.name`,admin?[f.schoolId]:[f.schoolId,uid])).rows;
 if(method==='GET'&&path==='/api/shop/admin')return {features:f,classes,items:(await db.query('SELECT * FROM app.shop_items WHERE school_id=$1 ORDER BY title',[f.schoolId])).rows,orders:await orders(db,f)};
 if(method==='GET'&&path==='/api/shop'){
  if(!f.shopEnabled)fail('The reward shop is disabled by your school.',403);
  const items=(await db.query('SELECT * FROM app.shop_items WHERE school_id=$1 AND active AND (class_id IS NULL OR class_id=ANY($2::uuid[])) ORDER BY title',[f.schoolId,classes.map(c=>c.id)])).rows;
  for(const item of items){item.remaining=item.stock===null?null:Math.max(0,item.stock-await used(db,item,uid,item.class_id));if(item.stock_scope==='class'&&!item.class_id){item.remainingByClass={};for(const c of classes)item.remainingByClass[c.id]=item.stock===null?null:Math.max(0,item.stock-await used(db,item,uid,c.id));item.remaining=null;}}
  return {features:f,classes,items,wallet:await wallet(db,uid,f),orders:await orders(db,f,uid)};
 }
 if(admin&&method==='POST'&&path==='/api/shop/admin/items'){
  const title=text(b.title,160,true),description=text(b.description,10000);if(!Number.isInteger(b.cost)||b.cost<1||b.cost>100000||!['student','class','school'].includes(b.stockScope)||!(b.stock===null||Number.isInteger(b.stock)&&b.stock>=0&&b.stock<=100000)||typeof b.active!=='boolean')fail('Check cost, stock and availability.');
  const classId=b.classId?uuid(b.classId):null;if(classId&&!classes.some(c=>c.id===classId))fail('Choose a class in your school.',403);
  if(b.id){const item=(await db.query('SELECT * FROM app.shop_items WHERE id=$1 AND school_id=$2 FOR UPDATE',[uuid(b.id),f.schoolId])).rows[0];if(!item)fail('Item not found.',404);const hasOrders=(await db.query('SELECT 1 FROM app.shop_order_lines WHERE item_id=$1 LIMIT 1',[item.id])).rowCount;if(hasOrders&&(classId!==item.class_id||b.stockScope!==item.stock_scope))fail('Items with orders must keep their original class and stock scope. Create a new item instead.');await db.query('UPDATE app.shop_items SET title=$3,description=$4,cost=$5,class_id=$6,stock_scope=$7,stock=$8,active=$9 WHERE id=$1 AND school_id=$2',[item.id,f.schoolId,title,description,b.cost,classId,b.stockScope,b.stock,b.active]);return {id:item.id};}
  return (await db.query('INSERT INTO app.shop_items(school_id,title,description,cost,class_id,stock_scope,stock,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[f.schoolId,title,description,b.cost,classId,b.stockScope,b.stock,b.active])).rows[0];
 }
 if(method==='POST'&&path==='/api/shop/checkout'){
  const request=uuid(b.requestId);if(!Array.isArray(b.lines)||!b.lines.length||b.lines.length>50)fail('Add between 1 and 50 items to your basket.');
  const lines=b.lines.map(l=>({itemId:uuid(l.itemId),quantity:l.quantity,expectedCost:l.expectedCost,classId:l.classId?uuid(l.classId):null})).sort((a,b)=>a.itemId.localeCompare(b.itemId));if(new Set(lines.map(l=>l.itemId)).size!==lines.length||lines.some(l=>!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>99||!Number.isInteger(l.expectedCost)||l.expectedCost<1))fail('Check basket quantities and prices.');
  const hash=createHash('sha256').update(JSON.stringify(lines)).digest('hex');
  await db.query('SELECT id FROM app.community_profiles WHERE firebase_uid=$1 FOR UPDATE',[uid]);
  const old=(await db.query('SELECT id,status,total,payload_hash FROM app.shop_orders WHERE student_uid=$1 AND request_id=$2',[uid,request])).rows[0];if(old){if(old.payload_hash!==hash)fail('This checkout was already submitted with a different basket.',409);return {id:old.id,status:old.status,total:old.total};}
  if(!f.shopEnabled)fail('The reward shop is disabled by your school.',403);
  const items=(await db.query('SELECT * FROM app.shop_items WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[lines.map(l=>l.itemId)])).rows;let total=0;
  for(const line of lines){const item=items.find(i=>i.id===line.itemId);if(!item||item.school_id!==f.schoolId||!item.active)fail('An item is no longer available. Refresh the shop.',409);if(item.cost!==line.expectedCost)fail('An item price changed. Refresh the shop and add it to your basket again.',409);if(line.classId&&!classes.some(c=>c.id===line.classId))fail('Choose a class you belong to.',403);if(item.class_id&&!classes.some(c=>c.id===item.class_id))fail('This item is for another class.',403);line.classId=item.class_id||(item.stock_scope==='class'?line.classId:null);if(item.stock_scope==='class'&&(!line.classId||!classes.some(c=>c.id===line.classId)))fail('Choose your class for this item.');if(item.stock!==null&&await used(db,item,uid,line.classId)+line.quantity>item.stock)fail('There is not enough stock for this basket.',409);line.title=item.title;line.cost=item.cost;total+=item.cost*line.quantity;}
  if(total>(await wallet(db,uid,f)).available)fail('You do not have enough available points.',409);
  const order=(await db.query('INSERT INTO app.shop_orders(school_id,student_uid,request_id,payload_hash,total) VALUES($1,$2,$3,$4,$5) RETURNING id,status,total',[f.schoolId,uid,request,hash,total])).rows[0];for(const line of lines)await db.query('INSERT INTO app.shop_order_lines(order_id,item_id,class_id,title,cost,quantity) VALUES($1,$2,$3,$4,$5,$6)',[order.id,line.itemId,line.classId,line.title,line.cost,line.quantity]);return order;
 }
 const review=path.match(/^\/api\/shop\/admin\/orders\/([^/]+)\/review$/);
 if(admin&&method==='POST'&&review){if(!['approved','rejected'].includes(b.decision))fail('Approve or reject this purchase.');const note=text(b.note||'',2000);const order=(await db.query('SELECT * FROM app.shop_orders WHERE id=$1 AND school_id=$2 FOR UPDATE',[uuid(review[1]),f.schoolId])).rows[0];if(!order)fail('Purchase not found.',404);if(order.status!=='pending'){if(order.status===b.decision)return {ok:true};fail('This purchase was already reviewed.',409);}await db.query('SELECT id FROM app.shop_items WHERE id IN (SELECT item_id FROM app.shop_order_lines WHERE order_id=$1) ORDER BY id FOR UPDATE',[order.id]);await db.query('UPDATE app.shop_orders SET status=$2,reviewer_uid=$3,review_note=$4,reviewed_at=now() WHERE id=$1',[order.id,b.decision,uid,note]);return {ok:true};}
 fail('Not found.',404);
}
