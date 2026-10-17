import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';

test('Nearby friends keep consent, invitations and approximate locations private', async t=>{
 const db=new PGlite();
 const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333';
 const switchTo=async(role,id='')=>{
  await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('SET SESSION AUTHORIZATION '+role);
 };
 const state=async()=> (await db.query('SELECT public.nearby_state() AS value')).rows[0].value;
 const call=async(sql,args=[])=>db.query(sql,args);
 let code,token;
 try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY)');
  await db.query('INSERT INTO auth.users VALUES($1),($2),($3)',[alice,bob,outsider]);
  await db.exec("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;");
  await db.exec(await readFile('docs/sql/friends-nearby-private-v1.sql','utf8'));
  await t.test('anonymous and direct table reads cannot reveal coordinates or profiles',async()=>{
   await switchTo('anon');
   await assert.rejects(call('SELECT public.nearby_state()'),/permission denied/);
   await switchTo('authenticated',outsider);
   for(const table of ['profiles','friendships','locations','blocks'])await assert.rejects(call('SELECT * FROM nearby_private.'+table),/permission denied/);
   assert.equal((await state()).friends.length,0);
   assert.equal((await state()).self.latitude,null);
   await assert.rejects(call('SELECT public.nearby_disconnect($1,true)',[alice]),/Friend unavailable/);
   assert.equal((await state()).blocked.length,0);
   await switchTo('authenticated');
   await assert.rejects(call('SELECT public.nearby_state()'),/Sign in required/);
  });
  await t.test('invitation is secret, expiring and does not give automatic access to the point',async()=>{
   await switchTo('authenticated',alice);
   code=(await call("SELECT public.nearby_invite('Алиса') AS code")).rows[0].code;
   assert.match(code,/^[a-f0-9]{32}$/);
   token=(await call('SELECT public.nearby_start_sharing() AS token')).rows[0].token;
   await call('SELECT public.nearby_share($1,$2,$3)',[58.455678,92.176543,token]);
   assert.equal((await state()).self.latitude,58.46);
   assert.equal((await state()).self.longitude,92.18);
   await switchTo('authenticated',bob);
   await call("SELECT public.nearby_request($1,'Борис')",[code]);
   const requested=(await state()).friends[0];
   assert.equal(requested.accepted,false);assert.equal(requested.latitude,null);
   assert(!JSON.stringify(requested).includes(code));
   await assert.rejects(call('SELECT public.nearby_respond($1,true)',[alice]),/Request unavailable/);
   await switchTo('authenticated',outsider);
   assert.deepEqual((await state()).friends,[]);
  });
  await t.test('only recipient can accept; accepted friend sees approximate one-hour point',async()=>{
   await switchTo('authenticated',alice);
   await call('SELECT public.nearby_respond($1,true)',[bob]);
   await switchTo('authenticated',bob);
   const point=(await state()).friends[0];
   assert.equal(point.accepted,true);assert.equal(point.latitude,58.46);assert.equal(point.longitude,92.18);
   assert(Date.parse(point.expires_at)>Date.now()+3500000);
   assert(!JSON.stringify(point).includes('58.455678'));
  });
  await t.test('consent is caller-bound, one-shot and cannot be replayed after hiding',async()=>{
   await switchTo('authenticated',alice);
   await assert.rejects(call('SELECT public.nearby_share($1,$2,$3)',[58.4,92.1,token]),/Sharing consent expired/);
   token=(await call('SELECT public.nearby_start_sharing() AS token')).rows[0].token;
   await switchTo('authenticated',bob);
   await assert.rejects(call('SELECT public.nearby_share($1,$2,$3)',[58.4,92.1,token]),/Sharing consent expired/);
   await switchTo('authenticated',alice);
   await call('SELECT public.nearby_hide()');
   await assert.rejects(call('SELECT public.nearby_share($1,$2,$3)',[58.4,92.1,token]),/Sharing consent expired/);
   await switchTo('authenticated',bob);
   assert.equal((await state()).friends[0].latitude,null);
  });
  await t.test('expired locations disappear on the server and invalid coordinates are rejected',async()=>{
   await switchTo('authenticated',alice);
   token=(await call('SELECT public.nearby_start_sharing() AS token')).rows[0].token;
   for(const coordinates of [[91,0],[0,181],[NaN,0],[Infinity,0],[null,0]])
    await assert.rejects(call('SELECT public.nearby_share($1,$2,$3)',[...coordinates,token]),/Invalid coordinates/);
   await call('SELECT public.nearby_share($1,$2,$3)',[58.45,92.17,token]);
   await switchTo('postgres');
   await db.exec("UPDATE nearby_private.locations SET expires_at=now()-interval '1 second'");
   await switchTo('authenticated',bob);
   assert.equal((await state()).friends[0].latitude,null);
   await switchTo('postgres');
   assert.equal((await call('SELECT count(*) AS n FROM nearby_private.locations')).rows[0].n,0);
  });
  await t.test('blocking immediately removes friendship; unblocking does not restore access',async()=>{
   await switchTo('authenticated',alice);
   await call('SELECT public.nearby_disconnect($1,true)',[bob]);
   assert.equal((await state()).friends.length,0);
   assert.equal((await state()).blocked.length,1);
   await switchTo('authenticated',bob);
   assert.equal((await state()).friends.length,0);
   await assert.rejects(call("SELECT public.nearby_request($1,'Борис')",[code]),/Invitation unavailable/);
   await switchTo('authenticated',alice);
   await call('SELECT public.nearby_disconnect($1,false)',[bob]);
   assert.equal((await state()).friends.length,0);
   await switchTo('authenticated',bob);
   await call("SELECT public.nearby_request($1,'Борис')",[code]);
   assert.equal((await state()).friends[0].accepted,false);
  });
  await t.test('rotated and expired invitation codes are denied; limits survive cancelling requests',async()=>{
   await switchTo('authenticated',alice);
   const next=(await call("SELECT public.nearby_invite('Алиса') AS code")).rows[0].code;
   await switchTo('authenticated',outsider);
   await assert.rejects(call("SELECT public.nearby_request($1,'Незнакомец')",[code]),/Invitation unavailable/);
   await switchTo('authenticated',bob);
   await call('SELECT public.nearby_disconnect($1,false)',[alice]);
   await switchTo('postgres');
   await call('UPDATE nearby_private.profiles SET requests_count=10 WHERE user_id=$1',[bob]);
   await switchTo('authenticated',bob);
   await assert.rejects(call("SELECT public.nearby_request($1,'Борис')",[next]),/Invitation limit/);
   await switchTo('postgres');
   await call("UPDATE nearby_private.profiles SET invite_expires=now()-interval '1 second' WHERE user_id=$1",[alice]);
   await switchTo('authenticated',outsider);
   await assert.rejects(call("SELECT public.nearby_request($1,'Незнакомец')",[next]),/Invitation unavailable/);
  });
  await t.test('public wrappers are invokers and all privileged functions have an empty search path',async()=>{
   await switchTo('postgres');
   const publicFunctions=(await call("SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname LIKE 'nearby_%'")).rows;
   assert.equal(publicFunctions.length,8);assert(publicFunctions.every(row=>!row.prosecdef));
   const privateFunctions=(await call("SELECT prosecdef,proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nearby_private'")).rows;
   assert.equal(privateFunctions.length,8);assert(privateFunctions.every(row=>row.prosecdef&&row.proconfig.some(setting=>setting.startsWith('search_path='))));
  });
 }finally{await db.close();}
});
