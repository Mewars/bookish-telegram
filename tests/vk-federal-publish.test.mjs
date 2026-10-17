import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createFederalPublisher,FEDERAL_WALL_ID,FEDERAL_GROUP_ID} from '../supabase/functions/vk-federal-publish/handler.ts';
const {Request,Response,URLSearchParams}=globalThis;
const requestId='d8e6b54a-4f14-4da2-813e-5b6eaa650842';
const userId='55b902a5-74c1-4a15-bec0-a9f289b03b3d';
const message='Открываем новый раздел платформы РЯДОМ для городских партнёров.';
const config={enabled:true,vkToken:'very-secret-vk-token-fixture',supabaseUrl:'https://ryadom.test',supabaseKey:'publishable-key'};
function request(body={message,requestId},headers={}){
 return new Request('https://example.com/functions/v1/vk-federal-publish',{method:'POST',headers:{
    'Authorization':'Bearer '+('a'.repeat(50)),
    'Origin':'https://ryadomcity.ru','Content-Type':'application/json',...headers,
 },body:JSON.stringify(body)});
}
const mock=(roles=['owner'],vkValue={response:{post_id:17}})=>{
 const calls=[];
 const upstream=async (url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user')) return Response.json({id:userId});
  if(url.includes('/rest/v1/city_admin_access'))return Response.json(roles.map(role=>({
    user_id:userId,city:role==='owner'?'*':'Енисейск',role,active:true
  })));
  if(url==='https://api.vk.com/method/groups.getTokenPermissions')return Response.json({response:{mask:8192,permissions:[{name:'wall',setting:8192}]}});
  if(url==='https://api.vk.com/method/wall.post')return Response.json(vkValue);
  throw Error('unexpected upstream '+url);
 };
 return {calls,upstream};
};
test('group number supplied by owner maps to negative VK wall ID',()=>{
 assert.equal(FEDERAL_GROUP_ID,242202919);
 assert.equal(FEDERAL_WALL_ID,-242202919);
});
test('closed by default, rejects unknown browser origins and unauthenticated POST',async()=>{
 const {calls,upstream}=mock();
 const closed=createFederalPublisher({...config,enabled:false,vkToken:''},upstream);
 assert.equal((await closed(request())).status,503);
 assert.equal(calls.length,0);
 const handler=createFederalPublisher(config,upstream);
 assert.equal((await handler(request(undefined,{Origin:'https://malicious.example'}))).status,403);
 assert.equal((await handler(request(undefined,{Authorization:''}))).status,401);
 assert.equal(calls.length,0);
});
test('read-only token preflight checks wall permission without publishing or unlocking server',async()=>{
 const {calls,upstream}=mock();
 const handler=createFederalPublisher({...config,enabled:false},upstream);
 const res=await handler(request({action:'check'}));
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{ok:true,wallPermission:true,publishingEnabled:false});
 const check=calls.find(call=>call.url==='https://api.vk.com/method/groups.getTokenPermissions');
 assert.ok(check);
 assert.equal(check.init.method,'POST');
 const body=new URLSearchParams(check.init.body);
 assert.equal(body.get('access_token'),config.vkToken);
 assert.equal(body.get('v'),'5.199');
 assert.equal(calls.some(call=>call.url.includes('/wall.post')),false);
 const send=await handler(request());
 assert.equal(send.status,503,'posting requires a distinct server-side enable flag');
 assert.equal(calls.some(call=>call.url.includes('/wall.post')),false);
});
test('checking key permissions requires owner JWT and never reveals VK errors',async()=>{
 const {calls,upstream}=mock(['editor']);
 const forbidden=await createFederalPublisher(config,upstream)(request({action:'check'}));
 assert.equal(forbidden.status,403);
 assert.equal(calls.some(call=>call.url.includes('/groups.getTokenPermissions')),false);
 const {upstream:base}=mock();
 const fail=async(url,init)=>url.includes('getTokenPermissions')
  ? Response.json({error:{error_msg:'secret-token-should-not-leak'}}) : base(url,init);
 const response=await createFederalPublisher(config,fail)(request({action:'check'}));
 assert.equal(response.status,502);
 assert.doesNotMatch(JSON.stringify(await response.json()),/secret-token/);
});
test('requires exact global owner; city staff and residents may not publish',async()=>{
 for(const roles of [['editor'],[],['owner','editor'].map(x=>x==='owner'?'city_owner':x)]){
  const {calls,upstream}=mock(roles);
  const res=await createFederalPublisher(config,upstream)(request());
  assert.equal(res.status,403);
  assert.ok(calls.every(call=>call.url!=='https://api.vk.com/method/wall.post'));
 }
});
test('owner confirmation posts one message only to fixed federal group, credential stays server-side',async()=>{
 const {calls,upstream}=mock();
 const res=await createFederalPublisher(config,upstream)(request());
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{ok:true,postId:17,postUrl:'https://vk.ru/wall-242202919_17'});
 const post=calls.find(call=>call.url==='https://api.vk.com/method/wall.post');
 assert.ok(post);
 assert.equal(post.init.method,'POST');
 assert.equal(post.init.redirect,'error');
 assert.equal(post.init.headers['Content-Type'],'application/x-www-form-urlencoded');
 const params=new URLSearchParams(post.init.body);
 assert.equal(params.get('owner_id'),'-242202919');
 assert.equal(params.get('from_group'),'1');
 assert.equal(params.get('message'),message);
 assert.equal(params.get('guid'),requestId);
 assert.equal(params.get('access_token'),config.vkToken);
 assert.ok(!res.headers.get('access-control-allow-origin')?.includes('*'));
 assert.doesNotMatch(JSON.stringify(await createFederalPublisher({...config,enabled:false},upstream)(request())),/very-secret/);
});
test('payload cannot choose another group, role or access token, malformed request IDs denied',async()=>{
 const {calls,upstream}=mock();
 const h=createFederalPublisher(config,upstream);
 for(const body of [
  {message,requestId,owner_id:-123},
  {message:'too short',requestId},
  {message,requestId:'not-a-uuid'},
  {message,requestId,access_token:'stolen-token'},
 ]){
   assert.equal((await h(request(body))).status,400);
 }
 assert.equal(calls.length,0);
});
test('VK rejection and network errors return sanitized results, never echo secrets',async()=>{
 const {upstream}=mock(['owner'],{error:{error_code:7,error_msg:'PRIVATE-SUPER-SECRET-DETAILS'}});
 const denial=await createFederalPublisher(config,upstream)(request());
 assert.equal(denial.status,502);
 assert.doesNotMatch(JSON.stringify(await denial.json()),/PRIVATE|secret|token/);
 const network=async(url)=>{
   if(url.includes('/auth/v1/user'))return Response.json({id:userId});
   if(url.includes('/city_admin_access'))return Response.json([{user_id:userId,city:'*',role:'owner',active:true}]);
   throw Error('PRIVATE-VK-TOKEN');
 };
 const err=await createFederalPublisher(config,network)(request());
 assert.equal(err.status,502);
 assert.deepEqual(await err.json(),{error:'vk_result_unknown',retryWithSameRequestId:true});
});
test('browser interface is hidden unless owner and explicit publishing flag; existing VK ID stays separate',async()=>{
 const [admin,composer,configFile,workflow]=await Promise.all([
  readFile('src/admin/AdminPage.tsx','utf8'),readFile('src/admin/VkFederalComposer.tsx','utf8'),
  readFile('src/config/vkCommunity.ts','utf8'),readFile('.github/workflows/sprinthost-deploy.yml','utf8'),
 ]);
 assert.match(admin,/screen === 'overview' && owner && import\.meta\.env\.VITE_VK_FEDERAL_POSTING_ENABLED === 'true' && <VkFederalComposer\/>/);
 assert.match(composer,/window\.confirm\(/);
 assert.match(composer,/crypto\.randomUUID\(\)/);
 assert.match(composer,/functions\.invoke\('vk-federal-publish'/);
 assert.match(composer,/requestId\.current\?\?=/);
 assert.match(configFile,/id: 242202919/);
 assert.match(workflow,/VITE_VK_FEDERAL_POSTING_ENABLED:\s*'true'/);
 assert.match(composer,/Проверить подключение ВК \(без публикации\)/);
 assert.match(composer,/!preflightPassed/);
});
