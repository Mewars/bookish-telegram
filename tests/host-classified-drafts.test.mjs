import assert from 'node:assert/strict';
import {test} from 'node:test';
import {saveOwnedDraft,submitOwnedDraft} from '../host-public/classifieds/drafts.js';

const draft={city:'Енисейск',author_id:'spoof',status:'published',title:'Исправленный стол',
  description:'Полное описание тестового стола',deal_type:'sell',category:'Для дома',district:'Центр',price_rub:100};
function mock(result={data:{id:'listing'},error:null}) {
  const operations=[];
  const query={update(value){operations.push(['update',value]);return this;},
    eq(k,v){operations.push(['eq',k,v]);return this;},in(k,v){operations.push(['in',k,v]);return this;},
    select(){return this;},async maybeSingle(){return result;}};
  return {client:{from:()=>query},operations};
}
test('host editor never submits city or author identity, resets rejected changes to draft',async()=>{
  const {client,operations}=mock();await saveOwnedDraft(client,'listing','author',draft);
  const payload=operations[0][1];
  assert.equal(payload.title,draft.title);assert.equal(payload.status,'draft');
  assert.ok(!('city' in payload));assert.ok(!('author_id' in payload));
  assert.ok(operations.some(x=>x[0]==='eq'&&x[1]==='author_id'&&x[2]==='author'));
  assert.ok(operations.some(x=>x[0]==='in'&&x[2].join(',')==='draft,rejected'));
});
test('zero affected rows or database error never become a false save/send success',async()=>{
  for(const fn of [saveOwnedDraft,submitOwnedDraft]) {
    await assert.rejects(fn(mock({data:null,error:null}).client,'listing','author',draft));
    await assert.rejects(fn(mock({data:null,error:new Error('denied')}).client,'listing','author',draft),/denied/);
  }
  const {client,operations}=mock();await submitOwnedDraft(client,'listing','author');
  assert.deepEqual(operations[0],['update',{status:'pending'}]);
});
