import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {getClassifiedUnreadCounts,markClassifiedMessagesRead} from '../src/classifieds/repository.ts';

test('inbox unread counts come from server, no invented client counts',async()=>{
  const calls=[];
  const client={async rpc(name,args){
    calls.push({name,args});
    if(name==='get_classified_unread_counts')return {data:[
      {conversation_id:'thread-one',unread_count:3},
      {conversation_id:'thread-two',unread_count:0},
      {conversation_id:'thread-three',unread_count:-1},
    ],error:null};
    return {data:null,error:{message:'unexpected'}};
  }};
  const counts=await getClassifiedUnreadCounts(client);
  assert.equal(Object.getPrototypeOf(counts),null);
  assert.deepEqual({...counts},{'thread-one':3});
  assert.equal(calls.length,1);
  assert.equal(calls[0].name,'get_classified_unread_counts');
  assert.equal(calls[0].args,undefined);
});

test('mark-read sends observed message ID only, not a client timestamp',async()=>{
  const calls=[];
  const client={async rpc(name,args){calls.push([name,args]);return {error:null};}};
  await markClassifiedMessagesRead(client,'thread-one','message-last-visible');
  assert.deepEqual(calls,[['mark_classified_messages_read',{
    p_conversation_id:'thread-one',p_message_id:'message-last-visible',
  }]]);
});

test('unread RPC failures do not fake successful read receipts',async()=>{
  const client={async rpc(){return {error:{message:'permission denied'},data:null};}};
  await assert.rejects(getClassifiedUnreadCounts(client),/Операция не выполнена/);
  await assert.rejects(markClassifiedMessagesRead(client,'id','id'),/Операция не выполнена/);
});

test('closed beta UI marks only visible chats as read and shows bounded labels',async()=>{
  const [page,sql,app,css]=await Promise.all([
    readFile('src/classifieds/ClassifiedsPage.tsx','utf8'),
    readFile('docs/sql/classified-unread-receipts-v1.sql','utf8'),
    readFile('src/App.tsx','utf8'),
    readFile('src/classifieds/classifieds.css','utf8'),
  ]);
  assert.match(page,/getClassifiedUnreadCounts\(supabase\)/);
  assert.match(page,/if\(!threadId\|\|tab!=='messages'\)/);
  assert.match(page,/const latest=rows\[rows\.length-1\]/);
  assert.match(page,/markClassifiedMessagesRead\(supabase,threadId,latest\.id\)/);
  assert.match(page,/Непрочитанных сообщений/);
  assert.match(page,/unreadCounts\[entry\.id\]>99\?'99\+'/);
  assert.match(css,/\.classifieds-unread-count/);
  assert.match(sql,/SECURITY INVOKER/);
  assert.match(sql,/SECURITY DEFINER SET search_path=''/);
  assert.match(sql,/CREATE POLICY classified_reads_private_to_reader/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.mark_classified_messages_read/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.get_classified_unread_counts/);
  assert.match(app,/VITE_CLASSIFIEDS_ENABLED === 'true'/);
  assert.match(app,/djqhixvlfsbvannoqdjw/);
});
