import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {CLASSIFIED_MESSAGE_PAGE_SIZE,getMessages,getOlderMessages} from '../src/classifieds/repository.ts';

function mockMessages(items,{fail=false}={}){
  const queries=[];
  return {
    queries,
    client:{
      from(table){
        assert.equal(table,'classified_messages');
        const q={thread:null,filter:null,orders:[]};
        queries.push(q);
        const chain={
          select(fields){assert.match(fields,/conversation_id/);return chain;},
          eq(field,value){assert.equal(field,'conversation_id');q.thread=value;return chain;},
          or(filter){q.filter=filter;return chain;},
          order(field,opts){q.orders.push({field,ascending:opts.ascending});return chain;},
          limit(amount){
            assert.equal(amount,CLASSIFIED_MESSAGE_PAGE_SIZE);
            if(fail)return Promise.resolve({data:null,error:{message:'network failed'}});
            let selected=items.filter(item=>item.conversation_id===q.thread);
            if(q.filter){
              const match=q.filter.match(/^created_at\.lt\.(.+),and\(created_at\.eq\.(.+),id\.lt\.([a-f0-9-]+)\)$/);
              assert(match,'keyset cursor expression must be valid');
              assert.equal(match[1],match[2],'cursor date must match on both branches');
              selected=selected.filter(item=>item.created_at<match[1] ||
                (item.created_at===match[1]&&item.id<match[3]));
            }
            selected.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
            return Promise.resolve({data:selected.slice(0,amount),error:null});
          },
        };
        return chain;
      },
    },
  };
}

const makeId=i=>String(i).padStart(8,'0')+'-1111-4111-8111-111111111111';
const messages=Array.from({length:225},(_,i)=>({
  id:makeId(i+1),
  conversation_id:'first-chat',
  sender_id:makeId(500),
  body:'Message '+(i+1),
  // Every four messages share a timestamp: boundaries must not omit tied rows.
  created_at:new Date(Date.UTC(2026,9,15,0,Math.floor(i/4),0)).toISOString(),
}));

test('all 225 messages can be read across stable newest-to-oldest pages',async()=>{
  const {queries,client}=mockMessages([
    ...messages,
    {id:makeId(999),conversation_id:'other-chat',sender_id:makeId(999),
      body:'Unrelated secret',created_at:'2030-01-01T00:00:00.000Z'},
  ]);
  const latest=await getMessages(client,'first-chat');
  const middle=await getOlderMessages(client,'first-chat',latest[0]);
  const oldest=await getOlderMessages(client,'first-chat',middle[0]);
  assert.deepEqual([latest.length,middle.length,oldest.length],[100,100,25]);
  const all=[...oldest,...middle,...latest];
  assert.deepEqual(all.map(x=>x.id),messages.map(x=>x.id));
  assert.equal(new Set(all.map(x=>x.id)).size,225);
  assert(!all.some(x=>x.conversation_id==='other-chat'));
  assert(queries.every(q=>q.thread==='first-chat'));
  assert(queries.every(q=>q.orders.length===2&&q.orders.every(o=>o.ascending===false)));
  assert.equal(queries.filter(q=>q.filter!==null).length,2);
});

test('older requests resist malformed PostgREST cursor injection and network errors',async()=>{
  const {client}=mockMessages(messages);
  await assert.rejects(getOlderMessages(client,'first-chat',{
    id:'not-an-id',created_at:'2026-10-15T00:00:00Z',
  }),/Некорректный указатель/);
  await assert.rejects(getOlderMessages(client,'first-chat',{
    id:makeId(3),created_at:'2026-10-15T00:00:00Z),and(other.eq.bad)',
  }),/Некорректный указатель/);
  const failed=mockMessages(messages,{fail:true});
  await assert.rejects(
    getOlderMessages(failed.client,'first-chat',messages[150]),
    /Операция не выполнена/,
  );
});

test('older-history UI has safe session refresh and retry without exposing beta',async()=>{
  const [page,app]=await Promise.all([
    readFile('src/classifieds/ClassifiedsPage.tsx','utf8'),
    readFile('src/App.tsx','utf8'),
  ]);
  assert.match(page,/useRef\(0\)/);
  assert.match(page,/historyGeneration\.current!==generation/);
  assert.match(page,/getOlderMessages\(supabase,threadId,oldest\)/);
  assert.match(page,/knownIds=new Set\(current\.map\(message=>message\.id\)\)/);
  assert.match(page,/hasOlderMessages&&currentMessages\.length>0/);
  assert.match(page,/Показать предыдущие сообщения/);
  assert.match(page,/olderMessagesError&&<p role="alert">/);
  assert.match(page,/setHasOlderMessages\(older\.length===CLASSIFIED_MESSAGE_PAGE_SIZE\)/);
  assert.match(app,/VITE_CLASSIFIEDS_ENABLED === 'true'/);
  assert.match(app,/djqhixvlfsbvannoqdjw/);
});
