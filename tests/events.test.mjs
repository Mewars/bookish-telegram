import assert from 'node:assert/strict';
import {test} from 'node:test';
import {calendarDay,currentEvents,eventOffset,eventOnDay,itemEventDate,holidaysToday} from '../src/utils/events.ts';
import {reviewedEvents} from '../src/data/events.ts';
import {matchesCatalogFilters,emptyCatalogFilters} from '../src/navigation/catalogRoute.ts';
const now=new Date('2026-10-25T12:00:00Z');
const cinema=reviewedEvents.find(x=>x.category==='Кино');
const theatre=reviewedEvents.find(x=>x.id.includes('gore-ot-uma'));
test('reviewed poster batch has five unique fixed-date cards and no other city leakage',()=>{
 assert.equal(reviewedEvents.length,5);assert.equal(new Set(reviewedEvents.map(x=>x.id)).size,5);
 for(const entry of reviewedEvents){assert.ok(entry.eventStart);assert.ok(entry.eventTimeZone);assert.equal(entry.dateOffset,undefined);assert.match(entry.image,/events\/2026-10\/.+\.webp$/);}
 assert.equal(currentEvents(reviewedEvents,now).length,5);
 assert.equal(currentEvents(reviewedEvents.filter(x=>x.city==='Лесосибирск'),now).length,0);
});
test('fixed dates never move with visits; ranges stay visible only through their final local day',()=>{
 assert.equal(eventOffset(theatre,now),1);
 assert.equal(eventOffset(theatre,new Date('2026-10-26T16:59:59Z')),0);
 assert.equal(eventOffset(theatre,new Date('2026-10-26T17:00:00Z')),-1);
 assert.equal(currentEvents([theatre],new Date('2026-10-26T17:00:00Z')).length,0);
 assert.equal(eventOffset(cinema,new Date('2026-10-28T16:59:59Z')),0);
 assert.equal(currentEvents([cinema],new Date('2026-10-28T17:00:00Z')).length,0);
 assert.equal(currentEvents(reviewedEvents,new Date('2026-11-15T17:00:00Z')).length,0);
 assert.match(itemEventDate(theatre,true),/26 октября/);assert.match(itemEventDate(cinema),/23.*28/);
});
test('today/tomorrow include a multiday schedule but never future-only or expired events',()=>{
 const today={...emptyCatalogFilters,when:'Сегодня'},tomorrow={...emptyCatalogFilters,when:'Завтра'};
 assert.equal(matchesCatalogFilters(cinema,today,now),true);
 assert.equal(matchesCatalogFilters(cinema,tomorrow,now),true);
 assert.equal(matchesCatalogFilters(theatre,today,now),false);
 assert.equal(matchesCatalogFilters(theatre,tomorrow,now),true);
 assert.equal(eventOnDay(cinema,1,new Date('2026-10-28T12:00:00Z')),false);
 assert.equal(eventOffset({...theatre,eventStart:'2026-02-30'},now)>=0,false);
 assert.equal(eventOffset({...theatre,eventEnd:'2026-01-01'},now)>=0,false);
});
test('date and holiday follow venue timezone, including another future city',()=>{
 const instant=new Date('2026-10-25T18:00:00Z');
 assert.equal(calendarDay(instant,'Asia/Krasnoyarsk'),'2026-10-26');assert.equal(calendarDay(instant,'Europe/Moscow'),'2026-10-25');
 assert.equal(eventOffset({...theatre,eventTimeZone:'Europe/Moscow'},instant),1);
 assert.equal(eventOffset(theatre,instant),0);
 assert.equal(holidaysToday(now).length,1);assert.equal(holidaysToday(instant).length,0);
 assert.equal(holidaysToday(new Date('2027-10-31T12:00:00Z')).length,1);
 assert.equal(holidaysToday(new Date('2027-10-25T12:00:00Z')).length,0);
});

test('homepage agenda uses city calendar weekends, explicit free prices and multi-day events',async()=>{
 const {agendaEvents}=await import('../src/home/agenda.ts');
 const now=new Date('2026-10-30T19:00:00Z'); // Saturday in Krasnoyarsk, Friday in UTC.
 const event=(id,start,end,price)=>({id,kind:'events',eventStart:start,eventEnd:end,eventTimeZone:'Asia/Krasnoyarsk',dateOffset:0,price});
 const rows=[event('sat','2026-10-31',undefined,'Бесплатно'),event('sun','2026-11-01',undefined,'0 ₽'),event('mon','2026-11-02',undefined,'Бесплатно'),event('unknown','2026-10-31',undefined,undefined),event('range','2026-10-29','2026-11-02','200 ₽')];
 assert.deepEqual(agendaEvents(rows,'weekend',false,now).map(x=>x.id),['sat','sun','unknown','range']);
 assert.deepEqual(agendaEvents(rows,'weekend',true,now).map(x=>x.id),['sat','sun']);
 assert.deepEqual(agendaEvents(rows,'tomorrow',false,now).map(x=>x.id),['sun','range']);
 assert.deepEqual(agendaEvents(rows,'weekend',false,new Date('2026-11-01T05:00:00Z')).map(x=>x.id),['sun','range']);
});
