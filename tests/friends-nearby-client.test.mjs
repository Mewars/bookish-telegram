import assert from 'node:assert/strict';
import {test} from 'node:test';
import {activePoint,approximateCoordinates,getNearbyState,nearbyCall} from '../src/friends/repository.ts';

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
