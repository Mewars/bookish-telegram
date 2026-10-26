import assert from 'node:assert/strict';
import {test} from 'node:test';
import {russianHolidays,importedEvents,mergeImportedEvents} from '../src/events/feeds.ts';
const now=new Date('2026-10-26T10:00:00Z');
const feed={checkedAt:now.toISOString(),sourceUrl:'https://www.calend.ru/holidays/russtate/',items:[{date:'2026-10-26',title:'День банкротства в России',sourceUrl:'https://www.calend.ru/holidays/0/0/3998/'},{date:'2026-10-28',title:'День бабушек и дедушек в России',sourceUrl:'https://www.calend.ru/holidays/0/0/3404/'}]};
test('Russian calendar filters exact local day, trusted source and stale feed',()=>{
 assert.equal(russianHolidays(feed,now).length,1);
 assert.equal(russianHolidays(feed,new Date('2026-10-28T10:00:00Z'))[0].title,'День бабушек и дедушек в России');
 assert.equal(russianHolidays(feed,new Date('2026-10-26T17:00:00Z')).length,0);
 assert.equal(russianHolidays({...feed,sourceUrl:'https://www.calend.ru/holidays/'},now).length,0);
 assert.equal(russianHolidays({...feed,checkedAt:'2026-10-01'},now).length,0);
 assert.equal(russianHolidays({...feed,items:[{...feed.items[0],sourceUrl:'https://evil.invalid/'}]},now).length,0);
});
const event={id:'vk-event-10-7',city:'Енисейск',sourceGroup:'gdk_e',kind:'events',title:'Проверка афиши',category:'Театр',eventStart:'2026-10-28',eventEnd:'2026-10-28',time:'16:00',sourceUrl:'https://vk.ru/wall-10_7',image:'/events/imported/vk-event-10-7-123456abcdef.webp',description:'Синтетический анонс'};
const afisha=items=>({checkedAt:now.toISOString(),items});
test('afisha uses local poster allowlist, correct source city and dates, and deduplicates cards',()=>{
 const entries=importedEvents(afisha([event,event]),now);assert.equal(entries.length,1);assert.equal(entries[0].city,'Енисейск');
 for(const change of [{city:'Лесосибирск'},{sourceGroup:'other'},{image:'https://evil.invalid/a.svg'},{eventStart:'2026-02-31'},{eventEnd:'2026-10-20'},{sourceUrl:'javascript:alert(1)'}])assert.equal(importedEvents(afisha([{...event,...change}]),now).length,0);
 assert.equal(importedEvents({...afisha([event]),checkedAt:'2026-10-01'},now).length,0);
 const existing={...entries[0],id:'manual-event',title:'Спектакль «Проверка афиши»'};
 assert.equal(mergeImportedEvents([existing],entries).length,1);
 assert.equal(mergeImportedEvents([{...existing,city:'Лесосибирск'}],entries).length,2);
});
