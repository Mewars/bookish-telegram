import assert from 'node:assert/strict';
import {test} from 'node:test';
import {activePoint,approximateCoordinates,getNearbyState,nearbyCall} from '../src/friends/repository.ts';
import {createHostNearbyClient} from '../src/friends/hostClient.ts';

test('host transport sends only the current session token to the same-origin API and records explicit consent',async()=>{
  const auth={auth:{getSession:async()=>({data:{session:{access_token:'synthetic-test-token'}}})}};
  let count=0;
  const client=createHostNearbyClient(auth,'/api/friends.php',async(url,init)=>{
    count++;assert.equal(url,'/api/friends.php');assert.equal(init.headers.Authorization,'Bearer synthetic-test-token');
    assert.equal(init.cache,'no-store');assert.equal(init.credentials,'omit');
    assert.deepEqual(JSON.parse(init.body),{name:'nearby_start_sharing',params:{p_consent_version:'FRIENDS-GEO-1.0'}});
    return {ok:true,json:async()=>({data:'one-shot-token',error:null})};
  });
  assert.equal(await nearbyCall(client,'nearby_start_sharing'),'one-shot-token');assert.equal(count,1);
  const signedOut=createHostNearbyClient({auth:{getSession:async()=>({data:{session:null}})}},'/api/friends.php',()=>{throw Error('No request permitted');});
  await assert.rejects(nearbyCall(signedOut,'nearby_state'),/Войдите/);
});
test('host transport cannot turn an HTTP failure or malformed response into successful private state',async()=>{
  const auth={auth:{getSession:async()=>({data:{session:{access_token:'synthetic-test-token'}}})}};
  for(const response of [{ok:false,json:async()=>({data:{friends:[]},error:null})},{ok:true,json:async()=>({})}]){
    const client=createHostNearbyClient(auth,'/api/friends.php',async()=>response);
    await assert.rejects(getNearbyState(client),/Не удалось/);
  }
});

test('exact GPS coordinates are rounded before entering a network request',()=>{
  assert.deepEqual(approximateCoordinates(58.455678,92.176543),{p_lat:58.46,p_lon:92.18});
  for(const pair of [[NaN,0],[Infinity,0],[91,0],[0,-181]])assert.throws(()=>approximateCoordinates(...pair));
});
test('expired and malformed locations never become visible map points',()=>{
  const point={latitude:58.45,longitude:92.17,expires_at:'2026-10-17T07:00:00Z'};
  const now=Date.parse('2026-10-17T06:00:00Z');
  assert.equal(activePoint(point,now),true);
  assert.equal(activePoint(point,Date.parse(point.expires_at)),false);
  for(const invalid of [{...point,latitude:null},{...point,longitude:NaN},{...point,expires_at:'invalid'},{...point,latitude:100}])assert.equal(activePoint(invalid,now),false);
});
test('failed privacy state reads stay errors and never invent an invisible or empty successful state',async()=>{
  await assert.rejects(getNearbyState(null),/не подключён/);
  await assert.rejects(getNearbyState({rpc:async()=>({data:null,error:{code:'500',message:'internal detail'}})}),/Не удалось/);
  const state={self:{latitude:null},friends:[],blocked:[]};
  assert.equal(await getNearbyState({rpc:async name=>{assert.equal(name,'nearby_state');return {data:state,error:null};}}),state);
});
test('unavailable invitations and quotas have useful messages without internal SQL details',async()=>{
  const client=code=>({rpc:async()=>({data:null,error:{code,message:'private table and user identifier'}})});
  await assert.rejects(nearbyCall(client('42501'),'nearby_request'),/Код недействителен/);
  await assert.rejects(nearbyCall(client('54000'),'nearby_request'),/Попробуйте завтра/);
});
