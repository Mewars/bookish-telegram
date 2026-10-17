import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {moderate,getMine,getPending} from '../src/classifieds/repository.ts';

test('reason is required before rejection and not sent on approval',async()=>{
  const calls=[];
  const client={rpc:async(name,params)=>{calls.push({name,params});return {error:null};}};
  await assert.rejects(moderate(client,'listing',false,'short'),/от 10 до 500/);
  assert.equal(calls.length,0,'bad rejection must not call the server');
  await moderate(client,'listing',false,'  Уточните качество фотографий. ');
  await moderate(client,'listing',true);
  assert.deepEqual(calls,[
    {name:'review_classified_with_reason',params:{p_listing_id:'listing',p_approve:false,p_reason:'Уточните качество фотографий.'}},
    {name:'review_classified_with_reason',params:{p_listing_id:'listing',p_approve:true,p_reason:null}},
  ]);
});
test('private reason is requested only for owner/editor views',async()=>{
  const requests=[];
  const client={from:()=>({
    select(fields){requests.push(fields);return {
      eq(){return this;},in(){return this;},order(){return this;},limit(){return Promise.resolve({data:[],error:null});}
    };}
  })};
  await getMine(client,'owned-user','Енисейск');
  await getPending(client,'Енисейск');
  assert.equal(requests.length,2);
  assert.ok(requests.every(text=>text.includes('rejection_reason')));
  const repo=await readFile('src/classifieds/repository.ts','utf8');
  assert.match(repo,/getPublished[\s\S]*?\.select\(FIELDS\)\.eq\('city',city\)/);
});
test('moderation UI has gated explanation and author-only feedback',async()=>{
  const [page,sql]=await Promise.all([
    readFile('src/classifieds/ClassifiedsPage.tsx','utf8'),
    readFile('docs/sql/classified-rejection-reasons-v1.sql','utf8'),
  ]);
  assert.match(page,/aria-expanded=\{rejectingId===entry\.id\}/);
  assert.match(page,/Причина отклонения \(10–500 символов\)/);
  assert.match(page,/Подтвердить отклонение/);
  assert.match(page,/entry\.status==='rejected'&&entry\.rejection_reason/);
  assert.match(sql,/FORCE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON public\.classified_moderation_history FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/GRANT SELECT \(rejection_reason\) ON public\.classifieds TO authenticated/);
  assert.doesNotMatch(sql,/GRANT UPDATE \(rejection_reason\)/);
  assert.match(sql,/v_author=v_user OR NOT EXISTS/);
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.review_classified/);
});
