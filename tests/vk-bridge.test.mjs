import assert from 'node:assert/strict';
import { test } from 'node:test';
import { URL, URLSearchParams } from 'node:url';
const { Request, Response, btoa } = globalThis;
import { createBridge, BASE_URL, AUTH_CALLBACK, VK_CALLBACK } from '../supabase/functions/vk-oauth-bridge/handler.ts';
import { randomSecret, digest, cipher } from '../supabase/functions/vk-oauth-bridge/crypto.ts';
import { postgresStore } from '../supabase/functions/vk-oauth-bridge/store.ts';

class Store {
  now=0; blocked=false; records=new Map();
  async put(kind,key,payload,ttl) { assert.match(key,/^[A-Za-z0-9_-]{43}$/); this.records.set(kind+':'+key,{payload,expires:this.now+ttl*1000}); }
  async get(kind,key) { const row=this.records.get(kind+':'+key); return row && row.expires>this.now?row.payload:null; }
  async take(kind,key) { const row=this.records.get(kind+':'+key); if (!row || row.expires<=this.now) return null; this.records.delete(kind+':'+key); return row.payload; }
  async limit() { return !this.blocked; }
}
async function setup(options={}) {
  const config={clientId:'ryadom-supabase',clientSecret:randomSecret(),encryptionKey:randomSecret(),vkAppId:'54818827',vkSecret:'fixture-server-secret'};
  const store=new Store(),calls=[];
  const upstream=async (url,init) => {
    calls.push({url,init}); assert.equal(init.method,'POST'); assert.equal(init.redirect,'error'); assert.ok(init.signal);
    assert.ok(!url.includes('?')); assert.ok(!url.includes('fixture-server-secret'));
    if (options.network) throw Error('PRIVATE-UPSTREAM-DETAILS');
    if (options.http) return new Response('PRIVATE-UPSTREAM-DETAILS',{status:401});
    if (options.invalidJson) return new Response('not-json');
    const p=new URLSearchParams(init.body);
    if (url.endsWith('/auth')) {
      assert.equal(p.get('device_id'),'device-fixture'); assert.equal(p.get('redirect_uri'),VK_CALLBACK);
      assert.equal(p.get('client_id'),'54818827'); assert.equal(p.get('grant_type'),'authorization_code');
      assert.equal(p.get('client_secret'),config.vkSecret);
      assert.match(p.get('code_verifier'),/^[A-Za-z0-9_-]{43}$/);
      return Response.json({access_token:'PRIVATE-VK-TOKEN',refresh_token:'PRIVATE-VK-REFRESH',user_id:42,token_type:'Bearer',expires_in:3600,state:options.wrongState?'wrong':p.get('state')});
    }
    assert.equal(url,'https://id.vk.ru/oauth2/user_info'); assert.equal(p.get('access_token'),'PRIVATE-VK-TOKEN');
    return Response.json({user:{user_id:options.wrongId?'43':'42',first_name:'Сосед',last_name:'Рядом',email:'existing@example.test',phone:'123',avatar:options.avatar??'https://example.test/avatar.png'}});
  };
  const handle=await createBridge(config,store,upstream);
  const verifier=randomSecret(),state='supabase-original-state';
  const authParams=new URLSearchParams({client_id:config.clientId,redirect_uri:AUTH_CALLBACK,response_type:'code',state,code_challenge:await digest(verifier),code_challenge_method:'S256',scope:'profile'});
  const authorize=() => handle(new Request(BASE_URL+'/authorize?'+authParams));
  const response=await authorize(); assert.equal(response.status,302);
  const location=new URL(response.headers.get('Location')),vkState=location.searchParams.get('state');
  const cookie=response.headers.get('Set-Cookie').split(';')[0];
  const callback=(changes={},cookieHeader=cookie) => {
    const p=new URLSearchParams({state:vkState,code:'fixture-vk-code',device_id:'device-fixture',...changes});
    return handle(new Request(BASE_URL+'/callback?'+p,{headers:cookieHeader?{Cookie:cookieHeader}:{}}));
  };
  const token=(code,overrides={},basic=false) => {
    const p=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:AUTH_CALLBACK,code_verifier:verifier,...overrides});
    const headers={'Content-Type':'application/x-www-form-urlencoded'};
    if (basic) headers.Authorization='Basic '+btoa(config.clientId+':'+config.clientSecret);
    else { p.set('client_id',config.clientId); p.set('client_secret',config.clientSecret); }
    return handle(new Request(BASE_URL+'/token',{method:'POST',headers,body:p}));
  };
  const finish=async () => {const result=await callback(); assert.equal(result.status,302); const target=new URL(result.headers.get('Location')); assert.equal(target.searchParams.get('state'),state); return target.searchParams.get('code');};
  const userinfo=(bearer) => handle(new Request(BASE_URL+'/userinfo',{headers:{Authorization:'Bearer '+bearer}}));
  return {handle,store,config,verifier,state,authParams,authorize,location,vkState,cookie,callback,token,finish,userinfo,calls};
}

test('complete OAuth2 protocol: independent PKCE, confidential client, one-use token, verified subject, no email',async()=>{
  const f=await setup();
  assert.notEqual(f.vkState,f.state); assert.equal(f.location.searchParams.get('redirect_uri'),VK_CALLBACK);
  assert.equal(f.location.searchParams.get('code_challenge_method'),'s256');
  assert.equal(f.location.searchParams.get('scope'),'vkid.personal_info');
  const auth=await f.authorize(); assert.match(auth.headers.get('Set-Cookie'),/Secure; HttpOnly; SameSite=Lax/);
  const code=await f.finish(); assert.match(code,/^[A-Za-z0-9_-]{43}$/);
  assert.ok(!JSON.stringify([...f.store.records]).includes(f.state)); assert.ok(!JSON.stringify([...f.store.records]).includes('PRIVATE-VK'));
  const response=await f.token(code,{},true); assert.equal(response.status,200);
  const value=await response.json(); assert.equal(value.expires_in,60); assert.equal(value.token_type,'Bearer');
  assert.equal(value.refresh_token,undefined);
  const profile=await f.userinfo(value.access_token); assert.equal(profile.status,200);
  assert.deepEqual(await profile.json(),{sub:'42',name:'Сосед Рядом',given_name:'Сосед',family_name:'Рядом',picture:'https://example.test/avatar.png'});
  assert.equal((await f.userinfo(value.access_token)).status,401);
  assert.equal((await f.token(code)).status,400);
  assert.equal((await f.callback()).status,400);
  assert.equal(f.calls.length,2);
});

test('repeat verified VK identity keeps the same subject, never trusts email/name for linking',async()=>{
  const subs=[];
  for(let i=0;i<2;i++) {const f=await setup(); const value=await (await f.token(await f.finish())).json(); const claims=await (await f.userinfo(value.access_token)).json(); subs.push(claims.sub); assert.equal(claims.email,undefined); assert.equal(claims.email_verified,undefined);}
  assert.deepEqual(subs,['42','42']);
});

test('invalid redirect/client/response type/state/PKCE/scope/duplicate parameters cannot start a login',async()=>{
  const f=await setup();
  for(const [key,value] of [['redirect_uri','https://evil.test/'],['client_id','other'],['response_type','token'],['state',''],['code_challenge','short'],['code_challenge_method','plain'],['scope','email']]) {
    const p=new URLSearchParams(f.authParams); p.set(key,value);
    assert.equal((await f.handle(new Request(BASE_URL+'/authorize?'+p))).status,400);
  }
  assert.equal((await f.handle(new Request(BASE_URL+'/authorize?'+f.authParams+'&client_id=other'))).status,400);
});

test('missing/wrong/duplicate browser cookie and unknown state fail without burning legitimate attempt',async()=>{
  const f=await setup();
  for(const cookie of ['',f.cookie.split('=')[0]+'='+randomSecret(),f.cookie+'; '+f.cookie]) assert.equal((await f.callback({},cookie)).status,400);
  assert.equal((await f.callback({state:randomSecret()})).status,400);
  assert.ok(await f.finish());
});

test('parallel callbacks and parallel code exchanges have exactly one winner',async()=>{
  const f=await setup();
  const results=await Promise.all([f.callback(),f.callback()]); assert.deepEqual(results.map(r=>r.status).sort(),[302,400]);
  const success=results.find(r=>r.status===302),code=new URL(success.headers.get('Location')).searchParams.get('code');
  const tokens=await Promise.all([f.token(code),f.token(code)]); assert.deepEqual(tokens.map(r=>r.status).sort(),[200,400]); assert.equal(f.calls.length,2);
});

test('wrong PKCE, redirect and client secret cannot redeem or destroy a valid code',async()=>{
  const f=await setup(),code=await f.finish();
  assert.equal((await f.token(code,{code_verifier:randomSecret()})).status,400);
  assert.equal((await f.token(code,{redirect_uri:'https://evil.test/'})).status,400);
  const bad=await f.handle(new Request(BASE_URL+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:f.config.clientId,client_secret:'wrong',code,grant_type:'authorization_code',redirect_uri:AUTH_CALLBACK,code_verifier:f.verifier})}));
  assert.equal(bad.status,401); assert.equal((await f.token(code)).status,200);
});

test('attempt/code/bearer expire independently; expired handles never return identity',async()=>{
  const attempt=await setup(); attempt.store.now=600001; assert.equal((await attempt.callback()).status,400);
  const code=await setup(),handle=await code.finish(); code.store.now=120001; assert.equal((await code.token(handle)).status,400);
  const bearer=await setup(),value=await (await bearer.token(await bearer.finish())).json(); bearer.store.now=60001; assert.equal((await bearer.userinfo(value.access_token)).status,401);
});

test('VK denial/error redirects only to the fixed Supabase callback with original state and no provider text',async()=>{
  for(const error of ['access_denied','<script>PRIVATE</script>']) {
    const f=await setup(),response=await f.callback({error,error_description:'PRIVATE-MESSAGE'});
    const location=new URL(response.headers.get('Location'));
    assert.equal(location.origin+location.pathname,AUTH_CALLBACK); assert.equal(location.searchParams.get('state'),f.state);
    assert.equal(location.searchParams.get('error'),error==='access_denied'?error:'server_error');
    assert.ok(!location.href.includes('PRIVATE')); assert.equal((await f.callback()).status,400); assert.equal(f.calls.length,0);
  }
});

for(const failure of ['network','http','invalidJson','wrongId','wrongState']) test('VK '+failure+' fails closed and never creates a bridge code',async()=>{
  const f=await setup({[failure]:true}),response=await f.callback();
  assert.equal(new URL(response.headers.get('Location')).searchParams.get('error'),'server_error');
  assert.ok(!response.headers.get('Location').includes('PRIVATE')); assert.equal(f.store.records.size,0);
});

test('missing code/device_id and duplicate callback fields fail without contacting VK',async()=>{
  for(const changes of [{code:''},{device_id:''}]) {const f=await setup(),response=await f.callback(changes); assert.equal(new URL(response.headers.get('Location')).searchParams.get('error'),'server_error'); assert.equal(f.calls.length,0);}
  const f=await setup(); assert.equal((await f.handle(new Request(BASE_URL+'/callback?state='+f.vkState+'&state='+f.vkState,{headers:{Cookie:f.cookie}}))).status,400);
});

test('method/query/media-type/body limits, token auth, refresh grants, caching and CORS',async()=>{
  const f=await setup();
  assert.equal((await f.handle(new Request(BASE_URL+'/token'))).status,405);
  assert.equal((await f.handle(new Request(BASE_URL+'/userinfo?access_token='+randomSecret()))).status,400);
  assert.equal((await f.handle(new Request(BASE_URL+'/userinfo'))).status,401);
  assert.equal((await f.handle(new Request(BASE_URL+'/token',{method:'POST',body:'{}'}))).status,415);
  assert.equal((await f.handle(new Request(BASE_URL+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'x='+('a'.repeat(9000))}))).status,413);
  assert.equal((await f.token('unknown',{grant_type:'refresh_token'})).status,400);
  const response=await f.handle(new Request(BASE_URL+'/unknown')); assert.equal(response.status,404);
  assert.equal(response.headers.get('Cache-Control'),'no-store'); assert.equal(response.headers.get('Referrer-Policy'),'no-referrer'); assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});

test('tampered encrypted records, storage failure and rate limits fail closed',async()=>{
  const f=await setup(); const key=[...f.store.records.keys()][0]; f.store.records.get(key).payload='corrupt';
  assert.equal((await f.callback()).status,503);
  f.store.blocked=true; assert.equal((await f.authorize()).status,429);
  f.store.limit=()=>{throw Error('PRIVATE-DATABASE-DETAILS')}; const response=await f.authorize(); assert.equal(response.status,503); assert.ok(!(await response.text()).includes('PRIVATE'));
});

test('AES-GCM binds records to kind+digest and detects modification',async()=>{
  const c=await cipher(randomSecret()),value=await c.seal({verifier:'private'},'attempt:one');
  assert.deepEqual(await c.open(value,'attempt:one'),{verifier:'private'});
  await assert.rejects(c.open(value,'code:one'));
  await assert.rejects(c.open(value+'x','attempt:one'));
});

test('Postgres adapter sends server key only as headers to fixed RPC paths; opaque failures',async()=>{
  const calls=[];
  const store=postgresStore('https://project.supabase.co','PRIVATE-SERVER-KEY',async(url,init)=>{calls.push({url,init}); return Response.json(null);});
  await store.put('code',await digest('code'),'encrypted',120);
  assert.equal(calls[0].url,'https://project.supabase.co/rest/v1/rpc/vk_bridge_record');
  assert.equal(calls[0].init.headers.Authorization,'Bearer PRIVATE-SERVER-KEY');
  assert.ok(!calls[0].init.body.includes('PRIVATE-SERVER-KEY'));
  const broken=postgresStore('https://project.supabase.co','private',async()=>new Response('PRIVATE-DATABASE-DETAILS',{status:500}));
  await assert.rejects(broken.get('code',await digest('code')),/Bridge storage unavailable/);
});
