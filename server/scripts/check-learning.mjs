import pg from 'pg';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createApp} from '../src/app.mjs';
import {databaseOptions} from '../src/config.mjs';
const pool=new pg.Pool(databaseOptions()),suffix=randomUUID(),alice='learning-check-a-'+suffix,bob='learning-check-b-'+suffix;
const app=createApp(pool,async req=>{if(![alice,bob].includes(req.headers.authorization))throw Error('No identity');return {uid:req.headers.authorization};});
await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
export const url='http://127.0.0.1:'+app.address().port;
export async function call(path,body,user=alice){const res=await fetch(url+'/api/learning'+path,{method:body?'POST':'GET',headers:{Authorization:user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:await res.json()};}
try{
const create=await call('/packs',{title:'Persistence check',subject:'Geography',year:'Y9',public:false,cards:[{front:'Erosion',back:'Wearing away rock.'}]});assert.equal(create.status,200);let pack=create.data.pack;
assert.equal((await call('/packs/'+pack.id,null,bob)).status,404);
const publish=await call('/packs/'+pack.dbId,{...pack,public:true});assert.equal(publish.status,200);pack=publish.data.pack;
assert.equal((await call('/packs/'+pack.id,null,bob)).data.pack.owned,false);
assert.equal((await call('/packs/'+pack.dbId,{...pack,title:'Not mine'},bob)).status,403);
assert.equal((await call('/packs/'+pack.dbId,{...pack,version:0})).status,409);
assert.equal((await call('/search?q=Persistnce%20chekc')).data.packs[0].id,pack.id);
const session=randomUUID();assert.equal((await call('/sessions',{id:session,pack:pack.dbId,method:'Absorb',questions:[{cardId:pack.cards[0].cardId,phase:'choice'},{cardId:pack.cards[0].cardId,phase:'recall'}]})).status,200);
assert.equal((await call('/sessions/'+session+'/answers',{question:0,correct:false,seconds:22})).status,200);
assert.equal((await call('/sessions/'+session+'/answers',{question:0,correct:true,seconds:12})).status,200);
assert.equal((await call('/sessions/'+session+'/answers',{question:1,correct:true,seconds:4},bob)).status,404);
const saved=(await call('/packs/'+pack.id)).data.pack;assert.equal(saved.cards[0].stats.attempts,1);assert.equal(saved.cards[0].stats.correct,1);assert.equal(saved.cards[0].stats.wrong,0);assert.ok(saved.lastStudied);assert.equal((await call('/packs/'+pack.id,null,bob)).data.pack.cards[0].stats,undefined);
assert.equal((await call('/sessions',{id:randomUUID(),pack:pack.dbId,method:'Absorb',questions:[{cardId:randomUUID(),phase:'choice'}]})).status,400);
console.log('Learning persistence, ownership, sharing, version conflicts, session isolation and answer idempotency passed.');
}finally{await pool.query('DELETE FROM app.learning_packs WHERE owner_uid=ANY($1)',[[alice,bob]]);await new Promise(r=>app.close(r));await pool.end();}
