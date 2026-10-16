import {learningRequest} from './learning.mjs';
import {resourceRequest} from './resources.mjs';
import {managementRequest,createSchoolAccount} from './schoolManagement.mjs';
import {shopRequest} from './shop.mjs';
import {schoolAdminOverview,schoolAdminAccount} from './schoolAdmin.mjs';
import {checkLogin} from './login.mjs';
import { behaviourRequest } from './behaviour.mjs';
import { taskRequest } from './tasks.mjs';
import { gradebookRequest } from './gradebook.mjs';
import { submissionRequest } from './submissions.mjs';
import { discussionRequest } from './discussions.mjs';
import { createServer } from 'node:http';
import { ensureProfile, updateProfile, listProfiles } from './community.mjs';
import { schoolRequest } from './school.mjs';

// Community routes require a verified Firebase identity.
export function createApp(pool, verify = async () => { throw new Error("Sign in required"); }) {
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (code, body) => { res.writeHead(code); res.end(JSON.stringify(body)); };
    const path = req.url?.split('?')[0];
    if(path==='/api/school-management/accounts'&&req.method==='POST'){
      let identity;try{identity=await verify(req);}catch{return send(401,{error:'Please sign in again.'});}let client;
      try{if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096)return send(413,{error:'Request too large'});}let body;try{body=JSON.parse(raw);}catch{return send(400,{error:'Invalid JSON'});}client=await pool.connect();return send(200,await createSchoolAccount(client,identity,body));}
      catch(error){return send(error.status||503,{error:error.status?error.message:'Account creation could not finish. Try the same request again.'});}finally{client?.release();}
    }
    if(path?.startsWith('/api/school-admin/accounts/')){
      if(!['GET','PATCH'].includes(req.method))return send(405,{error:'Method not allowed'});
      let identity;try{identity=await verify(req);}catch{return send(401,{error:'Please sign in again.'});}
      try{
        let body;
        if(req.method==='PATCH'){
          if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
          let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096)return send(413,{error:'Request too large'});}
          try{body=JSON.parse(raw);}catch{return send(400,{error:'Invalid JSON'});}
        }
        return send(200,await schoolAdminAccount(pool,identity,path.slice('/api/school-admin/accounts/'.length),body));
      }catch(error){return send(error.status||503,{error:error.status?error.message:'Account details could not load.'});}
    }
    if(path==='/api/school-admin'){
      if(req.method!=='GET')return send(405,{error:'Method not allowed'});
      let identity;try{identity=await verify(req);}catch{return send(401,{error:'Please sign in again.'});}
      try{return send(200,await schoolAdminOverview(pool,identity));}
      catch(error){return send(error.status||503,{error:error.status?error.message:'School overview could not load.'});}
    }
    if(path==='/api/schools' &&req.method==='GET') {
      try{return send(200,{schools:(await pool.query('SELECT id,name FROM app.schools ORDER BY name')).rows});}
      catch{return send(503,{error:'Schools could not load. Try again shortly.'});}
    }
    if(path==='/api/login/check') {
      if(req.method!=='POST')return send(405,{error:'Method not allowed'});
      let identity;try{identity=await verify(req);}catch{return send(401,{error:'Please sign in again.'});}
      try{
        if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096)return send(413,{error:'Request too large'});}
        let body;try{body=JSON.parse(raw);}catch{return send(400,{error:'Invalid JSON'});}
        return send(200,await checkLogin(pool,identity,body));
      }catch(error){return send(error.status||503,{error:error.status?error.message:'Login could not connect. Please try again.'});}
    }
    if (path?.startsWith('/api/learning')||path?.startsWith('/api/resources')||path==='/api/features'||path?.startsWith('/api/shop')||path?.startsWith('/api/school-management/')||path?.startsWith('/api/behaviour/') || path === '/api/tasks' || path?.startsWith('/api/tasks/') || path === '/api/school' || path?.startsWith('/api/school/')) {
      let identity;
      try { identity=await verify(req); } catch { return send(401,{error:'Please sign in again.'}); }
      let client;
      try {
        let body={};
        if(req.method==='POST') {
          if(!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'JSON required'});
          let size=0;const chunks=[]; for await(const chunk of req) {size+=chunk.length;chunks.push(chunk);if(size>36*1024*1024)return send(413,{error:'Assignment is too large.'});}
          const raw=Buffer.concat(chunks).toString('utf8');
          try {body=JSON.parse(raw);if(!body||Array.isArray(body)||typeof body!=='object')throw new Error();}catch{return send(400,{error:'Invalid JSON'});}
        }
        client=await pool.connect(); await client.query('BEGIN');
        if(path==='/api/learning/search'&&req.method==='GET')body.query=new URL(req.url,'http://localhost').searchParams.get('q')||'';
        const extended=/^\/api\/school\/(files\/|posts\/|classes\/[^/]+\/(settings|discussion)$)/.test(path);
        const submission=/\/(work|review-work)$/.test(path)||path.startsWith('/api/school/notifications');
        const result=await (path.startsWith('/api/learning')?learningRequest:path.startsWith('/api/resources')?resourceRequest:path==='/api/features'||path.startsWith('/api/school-management/')?managementRequest:path.startsWith('/api/shop')?shopRequest:path.startsWith('/api/behaviour/')?behaviourRequest:path.startsWith('/api/tasks')?taskRequest:path.startsWith('/api/school/gradebook')?gradebookRequest:submission?submissionRequest:extended?discussionRequest:schoolRequest)(client,identity,req.method,path,body);
        await client.query('COMMIT');
        if(result.download){res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(result.name).replace(/'/g,'%27')}`);res.setHeader('Content-Length',result.content.length);res.writeHead(200);return res.end(result.content);}
        return send(200,result);
      } catch(error) {
        if(client)await client.query('ROLLBACK').catch(()=>{});
        return send(error.status||503,{error:error.status?error.message:'School could not connect. Please try again.'});
      } finally {client?.release();}
    }
    if (path === '/api/me' || path === '/api/community') {
      const allowed = path === '/api/me' ? ['POST','PATCH'] : ['GET'];
      if (!allowed.includes(req.method)) { res.setHeader('Allow',allowed.join(', ')); return send(405,{error:'Method not allowed'}); }
      let identity;
      try { identity = await verify(req); } catch { return send(401,{error:'Please sign in again to use Community.'}); }
      try {
        if (path === '/api/community') return send(200,await listProfiles(pool,new URL(req.url,'http://localhost')));
        if (req.method === 'POST') return send(200,await ensureProfile(pool,identity));
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'JSON required'});
        let body='';
        for await (const chunk of req) { body+=chunk; if(Buffer.byteLength(body)>4096) return send(413,{error:'Profile is too large'}); }
        let parsed;
        try { parsed=JSON.parse(body); } catch { return send(400,{error:'Invalid JSON'}); }
        return send(200,await updateProfile(pool,identity,parsed));
      } catch(error) { return send(error.status || 503,{error:error.status ? error.message : 'Community is unavailable. Try again shortly.'}); }
    }
    if (path !== '/api/health') return send(404, { error: 'Not found' });
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'Method not allowed' }); }
    try {
      const { rows } = await pool.query('SELECT version FROM app.schema_migrations ORDER BY version DESC LIMIT 1');
      return send(200, { status: 'ok', service: 'postcrastination-backend', database: 'connected', schemaVersion: rows[0]?.version || null });
    } catch {
      // Never return connection strings, credentials or database diagnostics to clients.
      return send(503, { status: 'unavailable', database: 'unavailable' });
    }
  });
}
