import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateRejectionReason,rejectWallPost,loadReviewReasons,saveWallDraft} from '../host-public/wall/moderation.js';

test('refusal validates a reason before any network request',async()=>{
 assert.throws(()=>validateRejectionReason('  '),/причину/);
 assert.throws(()=>validateRejectionReason('x'.repeat(1001)),/причину/);
 let calls=0;
 const client={rpc:async(name,args)=>{calls++;assert.equal(name,'review_community_post_with_reason');assert.deepEqual(args,{p_id:'post',p_approve:false,p_reason:'Уточните адрес'});return {error:null}}};
 await assert.rejects(rejectWallPost(client,'post','x'),/причину/);
 assert.equal(calls,0);
 await rejectWallPost(client,'post','  Уточните адрес  ');
 assert.equal(calls,1);
 await assert.rejects(rejectWallPost({rpc:async()=>({error:Error('Denied')})},'post','Причина'),/Denied/);
});
test('private reasons are queried only for rejected records',async()=>{
 assert.equal((await loadReviewReasons(null,[{id:'public',status:'published'}])).size,0);
 const client={from(table){assert.equal(table,'community_post_review_reasons');return {select(fields){assert.equal(fields,'post_id,reason,reviewed_at');return this},in(field,ids){assert.equal(field,'post_id');assert.deepEqual(ids,['rejected']);return Promise.resolve({data:[{post_id:'rejected',reason:'Уточните адрес'}],error:null})}}}};
 const result=await loadReviewReasons(client,[{id:'public',status:'published'},{id:'rejected',status:'rejected'}]);
 assert.equal(result.get('rejected'),'Уточните адрес');
});
test('draft update resets rejected status and checks owner, status and returned row',async()=>{
 const calls=[];
 function client(result){const query={update(value){calls.push(['update',value]);return this},eq(...args){calls.push(['eq',...args]);return this},in(...args){calls.push(['in',...args]);return this},select(){return this},maybeSingle:async()=>result};return {from:()=>query}}
 await saveWallDraft(client({data:{id:'post'},error:null}),'post','author','  Название записи  ','  Достаточно подробный текст  ');
 assert.deepEqual(calls.slice(0,4),[
 ['update',{title:'Название записи',body:'Достаточно подробный текст',status:'draft'}],
 ['eq','id','post'],['eq','author_id','author'],['in','status',['draft','rejected']]]);
 await assert.rejects(saveWallDraft(client({data:null,error:null}),'post','author','Название записи','Достаточно подробный текст'),/недоступна/);
 await assert.rejects(saveWallDraft(client({data:null,error:Error('Denied')}),'post','author','Название записи','Достаточно подробный текст'),/Denied/);
});
