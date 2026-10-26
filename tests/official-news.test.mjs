import assert from 'node:assert/strict';
import {test} from 'node:test';
import {officialHeadlines} from '../src/home/officialNews.ts';
const now=new Date('2026-10-26T10:00:00Z'),origin='https://eniseysk.gosuslugi.ru/dlya-zhiteley/novosti-i-reportazhi/';
const good={title:'Официальная новость',date:'2026-10-25',url:origin+'novosti_123.html'};
const feed=items=>({city:'Енисейск',sourceUrl:origin,checkedAt:now.toISOString(),items});
test('only source headlines with explicit dates, correct city, no duplicates or external injection',()=>{
 assert.deepEqual(officialHeadlines(feed([good,good,{...good,url:'https://evil.test/'},{...good,date:'2026-02-30'},{...good,date:'2026-10-30'}]),'Енисейск',now),[good]);
 assert.deepEqual(officialHeadlines(feed([good]),'Лесосибирск',now),[]);
 assert.deepEqual(officialHeadlines({...feed([good]),checkedAt:'2026-10-01'},'Енисейск',now),[]);
 assert.deepEqual(officialHeadlines(feed([{...good,date:'2025-10-25'}]),'Енисейск',now),[{...good,date:'2025-10-25'}]);
 assert.deepEqual(officialHeadlines({items:[good]},'Енисейск',now),[]);
});
