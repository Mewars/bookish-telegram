import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {hasNewUnreadMessages,INBOX_REFRESH_INTERVAL_MS} from '../src/classifieds/inboxRefresh.ts';

test('incoming message hint only appears when a server count increases',()=>{
  assert.equal(hasNewUnreadMessages({'chat-a':2},{'chat-a':3}),true);
  assert.equal(hasNewUnreadMessages({'chat-a':2},{'chat-a':2}),false);
  assert.equal(hasNewUnreadMessages({'chat-a':2},{'chat-a':1}),false);
  assert.equal(hasNewUnreadMessages({'chat-a':2},{'chat-a':0}),false);
  assert.equal(hasNewUnreadMessages({'chat-a':2},{'chat-a':2,'chat-b':1}),true);
  assert.equal(hasNewUnreadMessages({},{}),false);
  assert.equal(hasNewUnreadMessages({}, {'chat-b':4}),true);
  assert.equal(hasNewUnreadMessages({}, {'chat-b':NaN}),false);
  assert.equal(hasNewUnreadMessages({}, {'chat-b':-4}),false);
  assert.equal(INBOX_REFRESH_INTERVAL_MS,60000);
});

test('inbox poll is active only in visible authenticated inbox, no browser prompts',async()=>{
  const [page,app,css]=await Promise.all([
    readFile('src/classifieds/ClassifiedsPage.tsx','utf8'),
    readFile('src/App.tsx','utf8'),
    readFile('src/classifieds/classifieds.css','utf8'),
  ]);
  assert.match(page,/if\(tab!=='messages'\|\|!userId\|\|loading\|\|loadFailedKey===viewKey\)return/);
  assert.match(page,/document\.visibilityState!=='visible'/);
  assert.match(page,/setInterval\(\(\)=>\{void refreshUnread\(\);\},INBOX_REFRESH_INTERVAL_MS\)/);
  assert.match(page,/document\.addEventListener\('visibilitychange',onVisibility\)/);
  assert.match(page,/document\.removeEventListener\('visibilitychange',onVisibility\)/);
  assert.match(page,/window\.clearInterval\(interval\)/);
  assert.match(page,/hasNewUnreadMessages\(unreadCountsRef\.current,counts\)/);
  assert.match(page,/newUnreadNotice&&<div className="classifieds-inbox-notice" role="status">/);
  assert.match(page,/Появились новые сообщения/);
  assert.match(page,/Обновить переписки/);
  assert.doesNotMatch(page,/Notification\.requestPermission|new Notification\(/);
  assert.match(css,/\.classifieds-inbox-notice/);
  assert.match(app,/VITE_CLASSIFIEDS_ENABLED === 'true'/);
  assert.match(app,/djqhixvlfsbvannoqdjw/);
});
