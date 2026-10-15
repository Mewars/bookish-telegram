import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {updateClassifiedDraft} from '../src/classifieds/repository.ts';

const draft={
  city:'Енисейск',deal_type:'sell',category:'Мебель',
  title:'  Стол письменный  ',description:'  Состояние хорошее, самовывоз  ',
  district:'  Центр  ',price_rub:2500,
};

test('classified draft editor updates only mutable attributes of owned drafts',async()=>{
  const operations=[];
  const query={
    update(payload){operations.push(['update',payload]);return this;},
    eq(field,value){operations.push(['eq',field,value]);return this;},
    in(field,values){operations.push(['in',field,values]);return this;},
    select(fields){operations.push(['select',fields]);return this;},
    maybeSingle(){operations.push(['maybeSingle']);return Promise.resolve({data:{id:'listing'},error:null});},
  };
  const client={from(table){assert.equal(table,'classifieds');return query;}};
  await updateClassifiedDraft(client,'listing','seller',draft);
  const updated=operations.find(x=>x[0]==='update')[1];
  assert.equal(updated.status,'draft');
  assert.equal(updated.title,'Стол письменный');
  assert.equal(updated.description,'Состояние хорошее, самовывоз');
  assert.equal(updated.district,'Центр');
  assert.equal(updated.price_rub,2500);
  assert.equal(updated.category,'Мебель');
  assert.equal(updated.deal_type,'sell');
  assert(!('author_id' in updated));
  assert(!('city' in updated));
  assert(operations.some(x=>x[0]==='eq'&&x[1]==='id'&&x[2]==='listing'));
  assert(operations.some(x=>x[0]==='eq'&&x[1]==='author_id'&&x[2]==='seller'));
  assert(operations.some(x=>x[0]==='in'&&x[1]==='status' &&
    x[2].join(',')==='draft,rejected'));
});

test('rejected and submitted drafts cannot be falsely reported as saved',async()=>{
  const query={
    update(){return this;},eq(){return this;},in(){return this;},
    select(){return this;},
    maybeSingle(){return Promise.resolve({data:null,error:null});},
  };
  const client={from:()=>query};
  await assert.rejects(
    updateClassifiedDraft(client,'listing','seller',draft),
    /Черновик нельзя изменить после отправки/,
  );
  await assert.rejects(
    updateClassifiedDraft(client,'listing','seller',{...draft,title:'a'}),
    /Название/,
  );
});

test('editor form supports correction before renewed review but not after submission',async()=>{
  const [page,sql,app]=await Promise.all([
    readFile('src/classifieds/ClassifiedsPage.tsx','utf8'),
    readFile('docs/sql/classifieds-private-messaging-v1.sql','utf8'),
    readFile('src/App.tsx','utf8'),
  ]);
  assert.match(page,/updateClassifiedDraft\(supabase,editingId,userId,draft\)/);
  assert.match(page,/entry\.author_id!==userId/);
  assert.match(page,/\['draft','rejected'\]\.includes\(entry\.status\)/);
  assert.match(page,/Редактирование объявления/);
  assert.match(page,/Сохранить исправления/);
  assert.match(sql,/classifieds_author_edit_unpublished/);
  assert.match(sql,/status IN \('draft','rejected'\)/);
  assert.match(app,/VITE_CLASSIFIEDS_ENABLED === 'true'/);
  assert.match(app,/isRyadomTestBackend/);
});
