import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getClassifiedReviewAccess,beginClassifiedRevision} from '../src/classifieds/repository.ts';

test('review affordances use explicit active roles scoped to the signed-in user and city',async()=>{
  const check=async(rows,expected)=>{
    const filters=[];
    const query={select(){return this;},eq(k,v){filters.push([k,v]);return this;},
      then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve);}};
    assert.deepEqual(await getClassifiedReviewAccess({from:()=>query},'Город теста','user'),expected);
    assert.deepEqual(filters,[['user_id','user'],['active',true]]);
  };
  const row={user_id:'user',city:'Город теста',role:'editor',active:true};
  await check([row],{canReview:true,canReviewOwn:false});
  await check([{...row,city:'*',role:'owner'}],{canReview:true,canReviewOwn:true});
  for(const bad of [{...row,city:'Другой город'},{...row,active:false},
    {...row,role:'viewer'},{...row,city:'*'},{...row,user_id:'other',city:'*',role:'owner'}])
    await check([bad],{canReview:false,canReviewOwn:false});
  await assert.rejects(getClassifiedReviewAccess({from:()=>({select(){return this;},eq(){return this;},
    then(resolve){resolve({data:null,error:{message:'unavailable'}});}})},'Город теста','user'));
});

test('revision sends only listing ID to narrow server operation and propagates failure',async()=>{
  const calls=[];
  await beginClassifiedRevision({rpc:async(name,args)=>{calls.push({name,args});return {error:null};}},'listing');
  assert.deepEqual(calls,[{name:'begin_classified_revision',args:{p_listing_id:'listing'}}]);
  await assert.rejects(beginClassifiedRevision({rpc:async()=>({error:{message:'denied'}})},'listing'),/Не удалось снять/);
});
