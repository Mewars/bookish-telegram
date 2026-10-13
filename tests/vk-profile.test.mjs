import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeVkAccount } from '../src/services/vkProfile.ts';

const profile={id:'stable-uuid',display_name:'',avatar_url:null,city:'Енисейск',created_at:'2026-01-01',updated_at:'2026-01-01'};
function fixture({provider='custom:vk',wrongOwner=false,edited=false,name='Verified VK',avatar='https://example.test/photo.png',sessionOwner='stable-uuid'}={}) {
  const changes=[]; const filters=[];
  const user={id:wrongOwner?'other-user':profile.id,created_at:profile.created_at,identities:[{identity_id:'verified-identity-uuid',id:'42',provider,identity_data:{sub:'42',name,picture:avatar},created_at:profile.created_at}]};
  const client={auth:{getUser:async()=>({data:{user},error:null}),getSession:async()=>({data:{session:{user:{id:sessionOwner}}},error:null})},from:table=>{
    assert.equal(table,'profiles');
    const query={update:value=>{changes.push(value);return query;},eq:(key,value)=>{filters.push([key,value]);return query;},is:(key,value)=>{filters.push([key,value]);return query;},select:()=>query,maybeSingle:async()=>({data:edited?null:{...profile,...changes.at(-1)},error:null})};
    return query;
  }};
  return {client,changes,filters};
}
test('VK profile comes only from getUser verified identity and fills empty fields conditionally',async()=>{
  const f=fixture(),result=await initializeVkAccount(f.client,profile);
  assert.equal(result.profile.display_name,'Verified VK');
  assert.deepEqual(f.changes,[{display_name:'Verified VK',avatar_url:'https://example.test/photo.png'}]);
  assert.ok(f.filters.some(([key,value])=>key==='id' && value===profile.id));
  assert.ok(f.filters.some(([key,value])=>key==='display_name' && value===''));
  assert.ok(f.filters.some(([key,value])=>key==='avatar_url' && value===null));
  assert.deepEqual(result.identity,{id:'verified-identity-uuid',user_id:profile.id,provider:'vk',provider_user_id:'42',created_at:profile.created_at});
});
test('email/Yandex accounts stay untouched',async()=>{
  for(const provider of ['email','custom:yandex']) {const f=fixture({provider}),result=await initializeVkAccount(f.client,profile); assert.equal(result.profile,profile);assert.equal(result.identity,null);assert.deepEqual(f.changes,[]);}
});
test('a different validated user cannot populate the current profile',async()=>{
  const f=fixture({wrongOwner:true});await assert.rejects(initializeVkAccount(f.client,profile),/проверить аккаунт/);assert.deepEqual(f.changes,[]);
});
test('existing names/avatars are never overwritten',async()=>{
  const f=fixture(),saved={...profile,display_name:'My edited name',avatar_url:'https://example.test/own.png'};
  const result=await initializeVkAccount(f.client,saved);assert.equal(result.profile,saved);assert.deepEqual(f.changes,[]);
});
test('logout/account change during enrichment cannot write a stale profile',async()=>{
  const f=fixture({sessionOwner:'other-user'});await assert.rejects(initializeVkAccount(f.client,profile),/сессия/);assert.deepEqual(f.changes,[]);
});
test('provider avatar uses HTTPS without embedded credentials',async()=>{
  for(const avatar of ['javascript:alert(1)','http://example.test/avatar','https://user:pass@example.test/avatar']) {
    const f=fixture({avatar,name:''}); const result=await initializeVkAccount(f.client,profile); assert.deepEqual(f.changes,[]);assert.equal(result.profile.avatar_url,null);
  }
});

test('concurrent profile edit wins; lost conditional update rereads account without overwriting',async()=>{
  const saved={...profile,display_name:'Concurrent edit',avatar_url:'https://example.test/own.png'};
  const f=fixture();let tableCalls=0;
  f.client.from=table=>{
    const current=++tableCalls;const query={update:()=>query,eq:()=>query,is:()=>query,select:()=>query,maybeSingle:async()=>({data:current===1?null:saved,error:null}),then:resolve=>resolve({data:[],error:null})};
    assert.ok(['profiles','user_identities'].includes(table));return query;
  };
  const result=await initializeVkAccount(f.client,profile);assert.deepEqual(result.profile,saved);
});
