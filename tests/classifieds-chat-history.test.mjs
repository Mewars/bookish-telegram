import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {CLASSIFIED_MESSAGE_PAGE_SIZE,getMessages} from '../src/classifieds/repository.ts';

function mockClient(messages,fail=false){
  const calls=[];
  const query={
    select(fields){calls.push(['select',fields]);return this;},
    eq(field,value){calls.push(['eq',field,value]);return this;},
    order(field,options){calls.push(['order',field,options]);return this;},
    limit(count){
      calls.push(['limit',count]);
      if(fail)return Promise.resolve({data:null,error:{message:'network error'}});
      const matching=messages.filter(m=>m.conversation_id===
        calls.find(x=>x[0]==='eq'&&x[1]==='conversation_id')?.[2]);
      const ordered=[...matching].sort((a,b)=>{
        const time=b.created_at.localeCompare(a.created_at);
        return time||b.id.localeCompare(a.id);
      });
      return Promise.resolve({data:ordered.slice(0,count),error:null});
    },
  };
  return {calls,client:{from(table){assert.equal(table,'classified_messages');return query;}}};
}

test('long chat loads newest 100 messages then displays them oldest-to-newest',async()=>{
  const input=Array.from({length:130},(_,i)=>({
    id:'msg-'+String(i+1).padStart(3,'0'),conversation_id:'chat-1',
    sender_id:'writer',body:'Message '+(i+1),
    created_at:new Date(Date.UTC(2026,9,15,0,0,i)).toISOString(),
  }));
  input.push({id:'other',conversation_id:'chat-2',sender_id:'third',
    body:'Secret elsewhere',created_at:'2030-01-01T00:00:00.000Z'});
  const {calls,client}=mockClient(input);
  const rows=await getMessages(client,'chat-1');
  assert.equal(CLASSIFIED_MESSAGE_PAGE_SIZE,100);
  assert.equal(rows.length,100);
  assert.equal(rows[0].body,'Message 31');
  assert.equal(rows[99].body,'Message 130');
  assert(!rows.some(x=>x.conversation_id==='chat-2'));
  assert(calls.some(x=>x[0]==='eq'&&x[1]==='conversation_id'&&x[2]==='chat-1'));
  assert(calls.some(x=>x[0]==='order'&&x[1]==='created_at'&&x[2].ascending===false));
  assert(calls.some(x=>x[0]==='order'&&x[1]==='id'&&x[2].ascending===false));
  assert(calls.some(x=>x[0]==='limit'&&x[1]===100));
});

test('failed message fetch is an error, not an empty successful chat',async()=>{
  const {client}=mockClient([],true);
  await assert.rejects(getMessages(client,'chat-1'),/Операция не выполнена/);
});

test('chat UI distinguishes pending, failed and genuinely empty messages',async()=>{
  const [page,app]=await Promise.all([
    readFile('src/classifieds/ClassifiedsPage.tsx','utf8'),
    readFile('src/App.tsx','utf8'),
  ]);
  assert.match(page,/const \[messageLoadedKey,setMessageLoadedKey\]=useState\(''\)/);
  assert.match(page,/const \[messageFailedKey,setMessageFailedKey\]=useState\(''\)/);
  assert.match(page,/setMessages\(\[\]\);setMessagesFor\(null\);setMessageFailedKey\(requestKey\)/);
  assert.match(page,/const currentMessages=messagesFor===threadId&&!messageLoading&&!messageLoadFailed/);
  assert.match(page,/messageLoading\?<p role="status">Загружаем сообщения/);
  assert.match(page,/messageLoadFailed\?<p role="alert">Не удалось загрузить сообщения/);
  assert.match(page,/disabled=\{busy\|\|isBlocked\|\|messageLoading\|\|messageLoadFailed/);
  assert.match(page,/hasOlderMessages&&currentMessages\.length>0/);
  assert.match(page,/Показать предыдущие сообщения/);
  assert.match(app,/VITE_CLASSIFIEDS_ENABLED === 'true'/);
  assert.match(app,/djqhixvlfsbvannoqdjw/);
});
