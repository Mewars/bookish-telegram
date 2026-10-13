import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { URL, URLSearchParams } from 'node:url';
const { Request, Response } = globalThis;
import { PGlite } from '@electric-sql/pglite';
import { digest, randomSecret } from '../supabase/functions/vk-oauth-bridge/crypto.ts';
import { createBridge, BASE_URL, AUTH_CALLBACK } from '../supabase/functions/vk-oauth-bridge/handler.ts';
import { postgresStore } from '../supabase/functions/vk-oauth-bridge/store.ts';

test('bridge SQL in isolated PostgreSQL: permissions, durable expiry, atomic take and full protocol',async t=>{
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.profiles(id text primary key,display_name text);
    CREATE TABLE public.user_identities(provider text); CREATE TABLE public.user_favorites(item_id text);
    INSERT INTO public.profiles VALUES ('existing-yandex','Existing'); INSERT INTO public.user_identities VALUES ('yandex');
    INSERT INTO public.user_favorites VALUES ('saved-place');`);
  await db.exec(await readFile(new URL('../docs/sql/vk-oauth-bridge.sql',import.meta.url),'utf8'));
  const role=async name=>{await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE'); await db.exec('SET SESSION AUTHORIZATION '+(name??'postgres'));};
  const rpc=async(op,kind,key,payload=null,ttl=0)=>(await db.query('SELECT public.vk_bridge_record($1,$2,$3,$4,$5) as value',[op,kind,key,payload,ttl])).rows[0].value;
  const key=await digest('fixture-handle'),payload='encrypted-fixture'.repeat(4);
  try {
    await t.test('existing users/profiles/identities/favorites untouched',async()=>{
      assert.deepEqual((await db.query('SELECT * FROM public.profiles')).rows,[{id:'existing-yandex',display_name:'Existing'}]);
      assert.equal((await db.query('SELECT count(*) as n FROM public.user_identities')).rows[0].n,1);
      assert.equal((await db.query('SELECT count(*) as n FROM public.user_favorites')).rows[0].n,1);
    });
    await t.test('anon and authenticated cannot read private data or invoke definer RPC',async()=>{
      for(const name of ['anon','authenticated']) {
        await role(name);
        await assert.rejects(db.query('SELECT * FROM vk_bridge_private.records'),/permission denied/);
        await assert.rejects(rpc('get','attempt',key),/permission denied/);
        await assert.rejects(db.query("SELECT public.vk_bridge_rate_limit('authorize')"),/permission denied/);
        await assert.rejects(db.query('SET ROLE service_role'),/permission denied/);
      }
    });
    await t.test('service role can use only restricted RPC, not direct private tables',async()=>{
      await role('service_role');
      await assert.rejects(db.query('SELECT * FROM vk_bridge_private.records'),/permission denied/);
      await rpc('put','code',key,payload,120);
      assert.equal(await rpc('get','code',key),payload);
      await assert.rejects(rpc('put','code',key,payload,120),/duplicate key/);
      await assert.rejects(rpc('put','code',await digest('oversize'),payload,121),/Invalid bridge expiry/);
      await assert.rejects(rpc('put','unknown',key,payload,1),/Invalid bridge record/);
      await assert.rejects(rpc('get','code','raw-unhashed-handle'),/Invalid bridge record/);
      await assert.rejects(rpc('delete-all','code',key),/Invalid bridge operation/);
    });
    await t.test('two independent requests cannot redeem the same record',async()=>{
      const results=await Promise.all([rpc('take','code',key),rpc('take','code',key)]);
      assert.deepEqual(results.sort(),[payload,null].sort()); assert.equal(await rpc('get','code',key),null);
    });
    await t.test('database expiry is authoritative and cleanup requires no scheduled service',async()=>{
      await rpc('put','attempt',key,payload,600);
      await role(); await db.exec("UPDATE vk_bridge_private.records SET expires_at=clock_timestamp()-interval '1 second'");
      await role('service_role'); assert.equal(await rpc('get','attempt',key),null); assert.equal(await rpc('take','attempt',key),null);
      await rpc('put','bearer',await digest('fresh'),payload,60);
      await role(); assert.equal((await db.query('SELECT count(*) as n FROM vk_bridge_private.records')).rows[0].n,1);
    });
    await t.test('rate limit is durable and scoped, resets at next time window',async()=>{
      await role('service_role');
      for(let i=0;i<120;i++) assert.equal((await db.query("SELECT public.vk_bridge_rate_limit('authorize') as ok")).rows[0].ok,true);
      assert.equal((await db.query("SELECT public.vk_bridge_rate_limit('authorize') as ok")).rows[0].ok,false);
      await assert.rejects(db.query("SELECT public.vk_bridge_rate_limit('attacker')"),/Invalid bridge rate scope/);
      await role(); await db.exec("UPDATE vk_bridge_private.rate_limits SET minute=clock_timestamp()-interval '5 minute'");
      await role('service_role'); assert.equal((await db.query("SELECT public.vk_bridge_rate_limit('authorize') as ok")).rows[0].ok,true);
    });
    await t.test('full handler through REST adapter and real RPC, independent Edge instances',async()=>{
      const config={clientId:'fixture-client',clientSecret:randomSecret(),encryptionKey:randomSecret(),vkAppId:'54818827'};
      const request=async(url,init)=>{
        const args=JSON.parse(init.body); let result;
        if(url.endsWith('vk_bridge_record')) result=await rpc(args.op,args.record_kind,args.record_digest,args.encrypted_payload,args.ttl_seconds);
        else result=(await db.query('SELECT public.vk_bridge_rate_limit($1) as value',[args.rate_scope])).rows[0].value;
        return Response.json(result);
      };
      const upstream=async(url)=>{const endpoint=new URL(url);return Response.json(endpoint.pathname.endsWith('/auth')?{access_token:'vk-private',token_type:'Bearer',expires_in:3600,user_id:123,state:endpoint.searchParams.get('state')}:{user:{user_id:'123',first_name:'Verified',email:'existing@example.test'}});};
      const a=await createBridge(config,postgresStore('https://local-store.test','local',request),upstream);
      const b=await createBridge(config,postgresStore('https://local-store.test','local',request),upstream);
      const verifier=randomSecret();
      const authorization=await a(new Request(BASE_URL+'/authorize?'+new URLSearchParams({client_id:config.clientId,redirect_uri:AUTH_CALLBACK,response_type:'code',state:'supabase-flow',code_challenge:await digest(verifier),code_challenge_method:'S256'})));
      const state=new URL(authorization.headers.get('Location')).searchParams.get('state');
      const callback=await b(new Request(BASE_URL+'/callback?'+new URLSearchParams({state,code:'vk-code',device_id:'device'}),{headers:{Cookie:authorization.headers.get('Set-Cookie').split(';')[0]}}));
      const code=new URL(callback.headers.get('Location')).searchParams.get('code'); assert.ok(code);
      const exchange=()=>new Request(BASE_URL+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,grant_type:'authorization_code',code,redirect_uri:AUTH_CALLBACK,code_verifier:verifier})});
      const responses=await Promise.all([a(exchange()),b(exchange())]); assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
      const bearer=(await responses.find(r=>r.status===200).json()).access_token;
      const userinfo=await b(new Request(BASE_URL+'/userinfo',{headers:{Authorization:'Bearer '+bearer}}));
      assert.deepEqual(await userinfo.json(),{sub:'123',name:'Verified',given_name:'Verified',family_name:''});
      await role(); const records=(await db.query('SELECT * FROM vk_bridge_private.records')).rows;
      assert.ok(!JSON.stringify(records).includes('vk-private')); assert.ok(!JSON.stringify(records).includes('Verified'));
    });
  } finally {await db.close();}
});
