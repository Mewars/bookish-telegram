import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createAntiSpamHandler} from '../supabase/functions/ryadom-antispam/handler.ts';
import {antiSpamConfig,verifyHuman} from '../public/security/antispam.js';
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
test('server validates identity, hostname, action and provider result before issuing a permit',async()=>{
 const env={SUPABASE_URL:'https://database.example',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'server-fixture',TURNSTILE_SECRET_KEY:'server-only-fixture-secret',TURNSTILE_ALLOWED_HOSTNAMES:'city.example'};
 let outcome={success:true,hostname:'city.example',action:'classified'},identity=true,grants=0,providerCalls=0;
 const calls=[];
 const handler=createAntiSpamHandler(env,async(url,options)=>{
  calls.push(url);
  if(url.endsWith('/auth/v1/user'))return Response.json(identity?{id:uid}:{},{status:identity?200:401});
  if(url.endsWith('/antispam_public_config'))return Response.json({content_enabled:true});
  if(url.includes('siteverify')){providerCalls++;assert.equal(JSON.parse(options.body).secret,env.TURNSTILE_SECRET_KEY);return Response.json(outcome);}
  if(url.endsWith('/antispam_grant')){grants++;assert.equal(JSON.parse(options.body).p_user_id,uid);return Response.json(null);}
  throw Error('Unexpected request');
 });
 const send=(body={token:'one-use-token',action:'classified'},origin='https://city.example',auth='Bearer user-fixture')=>handler(new Request('https://edge.example',{method:'POST',headers:{origin,authorization:auth},body:JSON.stringify(body)}));
 assert.equal((await send()).status,200);assert.equal(grants,1);
 for(const result of [{success:false},{success:true,hostname:'evil.example',action:'classified'},{success:true,hostname:'city.example',action:'wall_post'}]){outcome=result;assert.equal((await send()).status,403);}
 assert.equal(grants,1);
 assert.equal((await send({token:'x',action:'owner'})).status,400);
 assert.equal((await send(undefined,'https://evil.example')).status,403);
 const before=providerCalls;identity=false;assert.equal((await send()).status,401);assert.equal(providerCalls,before);
 assert.equal((await send(undefined,'https://city.example','')).status,401);
 assert.equal((await send({token:'x'.repeat(9000),action:'classified'})).status,413);
 const down=createAntiSpamHandler({...env,TURNSTILE_SECRET_KEY:''},async()=>{throw Error('Must not contact backend');});
 assert.equal((await down(new Request('https://edge.example',{method:'POST',headers:{origin:'https://city.example'}}))).status,503);
 assert(!calls.some(url=>url.includes('secret')));
});
test('disabled staged rollout works; config/network errors cannot silently bypass verification',async()=>{
 assert.deepEqual(await antiSpamConfig({rpc:async()=>({data:null,error:{code:'PGRST202'}})}),{auth_enabled:false,content_enabled:false,site_key:null});
 await verifyHuman({rpc:async()=>({data:{auth_enabled:false,content_enabled:false},error:null})},'classified');
 await assert.rejects(verifyHuman({rpc:async()=>({error:{message:'offline'}})},'classified'),/безопасности/);
 await assert.rejects(verifyHuman({rpc:async()=>({data:{auth_enabled:false,content_enabled:true,site_key:null}})},'classified'),/недоступна/);
});
test('direct REST writes require a user-bound, expiring, row-bound permit even when UI is bypassed',async()=>{
 const db=new PGlite();
 const role=async(name,id='')=>{await db.exec('RESET SESSION AUTHORIZATION');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET SESSION AUTHORIZATION '+name);};
 const insert=(table,id)=>db.query(`insert into public.${table}(id) values($1) returning id`,[id]);
 const grant=async(action,id=null)=>{await role('service_role');await db.query('select public.antispam_grant($1,$2,$3)',[uid,action,id]);await role('authenticated',uid);};
 try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
   CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${uid}'),('${other}');
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`);
  for(const table of ['classifieds','community_posts','community_comments','organization_applications'])await db.exec(`CREATE TABLE public.${table}(id uuid PRIMARY KEY,author_id uuid DEFAULT auth.uid(),status text DEFAULT 'draft',post_type text DEFAULT 'post');ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;GRANT SELECT,INSERT,UPDATE ON public.${table} TO authenticated;CREATE POLICY own ON public.${table} TO authenticated USING(author_id=auth.uid()) WITH CHECK(author_id=auth.uid() AND status IN ('draft','pending'));`);
  await db.exec(await readFile('docs/sql/antispam-turnstile-v1.sql','utf8'));
  await role('anon');assert.equal((await db.query('select public.antispam_public_config() c')).rows[0].c.content_enabled,false);
  await assert.rejects(db.query('select public.antispam_grant($1,$2,null)',[uid,'classified']),/permission denied/);
  await role('authenticated',uid);await insert('classifieds','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  await role('postgres');await assert.rejects(db.exec('update antispam_private.settings set content_enabled=true'),/check constraint/);
  await db.exec("update antispam_private.settings set site_key='real-site-fixture',content_enabled=true");
  await role('authenticated',uid);await assert.rejects(insert('classifieds','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),/не робот/);
  await assert.rejects(db.query('select public.antispam_grant($1,$2,null)',[uid,'classified']),/permission denied/);
  await grant('classified');await role('authenticated',other);await assert.rejects(insert('classifieds','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),/не робот/);
  await role('authenticated',uid);await assert.rejects(insert('community_posts','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),/не робот/);
  const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';await insert('classifieds',id);
  await assert.rejects(db.exec("update public.classifieds set status='pending' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"),/не робот/);
  await db.query("update public.classifieds set status='pending' where id=$1",[id]);
  await assert.rejects(insert('classifieds','cccccccc-cccc-4ccc-8ccc-cccccccccccc'),/не робот/);
  await assert.rejects(db.query("update public.classifieds set status='published' where id=$1",[id]),/row-level security/);
  await grant('classified',id);await db.query("update public.classifieds set status='draft' where id=$1",[id]);await db.query("update public.classifieds set status='pending' where id=$1",[id]);
  await grant('wall_post');const post='dddddddd-dddd-4ddd-8ddd-dddddddddddd';await insert('community_posts',post);await db.query("update public.community_posts set status='pending' where id=$1",[post]);
  for(const [action,table,id] of [['wall_comment','community_comments','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'],['organization','organization_applications','ffffffff-ffff-4fff-8fff-ffffffffffff']]){await grant(action);await insert(table,id);await assert.rejects(insert(table,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),/не робот/);}
  await grant('classified');await role('postgres');await db.exec("update antispam_private.permits set expires_at=now()-interval '1 second'");await role('authenticated',uid);await assert.rejects(insert('classifieds','cccccccc-cccc-4ccc-8ccc-cccccccccccc'),/не робот/);
  await assert.rejects(db.query('select * from antispam_private.permits'),/permission denied/);
 }finally{await db.close();}
});
