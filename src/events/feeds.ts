import type {Item} from '../types';
import sources from '../../data/afisha-sources.json' with {type:'json'};
import {calendarDay} from '../utils/events';
export interface RussianHoliday {date:string;title:string;description:string;sourceUrl:string}
function record(value:unknown):Record<string,unknown>|null{return value!==null&&typeof value==='object'?value as Record<string,unknown>:null;}
function date(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
function feed(value:unknown,now:Date,days:number):Record<string,unknown>|null{
 const obj=record(value);if(!obj||typeof obj.checkedAt!=='string'||!Array.isArray(obj.items))return null;
 const age=now.getTime()-Date.parse(obj.checkedAt);return Number.isFinite(age)&&age>=-600000&&age<=days*86400000?obj:null;
}
export function russianHolidays(value:unknown,now=new Date(),timeZone?:string):RussianHoliday[]{
 const obj=feed(value,now,8);if(obj?.sourceUrl!=='https://www.calend.ru/holidays/russtate/')return [];
 const today=calendarDay(now,timeZone);const seen=new Set<string>();
 return (obj.items as unknown[]).flatMap(raw=>{
  const row=record(raw);if(!row||row.date!==today||typeof row.title!=='string'||row.title.length>250||typeof row.sourceUrl!=='string'||!/^https:\/\/www\.calend\.ru\/holidays\/0\/0\/\d+(?:\/\d+)?\/$/.test(row.sourceUrl)||seen.has(row.sourceUrl))return [];
  seen.add(row.sourceUrl);return [{date:today,title:row.title,description:'По календарю «Праздники России» Calend.ru.',sourceUrl:row.sourceUrl}];
 }).slice(0,3);
}
export function importedEvents(value:unknown,now=new Date()):Item[]{
 const obj=feed(value,now,3);if(!obj)return [];
 const seen=new Set<string>();
 return (obj.items as unknown[]).flatMap(raw=>{
  const row=record(raw);if(!row)return [];
  const source=sources.find(item=>item.domain===row.sourceGroup&&item.city===row.city);
  if(!source||typeof row.id!=='string'||!/^vk-event-\d+-\d+$/.test(row.id)||seen.has(row.id)||row.kind!=='events'||typeof row.title!=='string'||row.title.length<3||row.title.length>160||!date(row.eventStart)||!date(row.eventEnd)||row.eventEnd<row.eventStart||row.eventEnd<calendarDay(now,source.timeZone)||typeof row.time!=='string'||typeof row.sourceUrl!=='string'||!/^https:\/\/vk\.ru\/wall-\d+_\d+$/.test(row.sourceUrl)||typeof row.image!=='string'||!/^\/events\/imported\/vk-event-\d+-\d+-[a-f0-9]{12}\.(jpg|png|webp)$/.test(row.image))return [];
  seen.add(row.id);return [{id:row.id,city:source.city,kind:'events' as const,title:row.title,category:['Кино','Театр','Концерты','Мероприятия'].includes(String(row.category))?String(row.category):source.category,image:row.image,description:String(row.description??'').slice(0,300),details:String(row.details??'').slice(0,800),address:source.address,provider:source.name,eventStart:row.eventStart,eventEnd:row.eventEnd,eventTimeZone:source.timeZone,time:row.time.slice(0,200),label:String(row.label??'').slice(0,5),sourceUrl:row.sourceUrl,sourceType:'official_social'}];
 }).slice(0,100);
}
export function mergeImportedEvents(local:Item[],remote:Item[]):Item[]{
 const key=(item:Item)=>[item.city,item.eventStart,item.title.toLowerCase().replace(/ё/g,'е').replace(/спектакль|концерт|премьера/g,'').replace(/[^\p{L}\p{N}]/gu,'')].join('|');
 const seen=new Set<string>();return [...remote,...local].filter(item=>{if(item.kind!=='events')return true;const id=key(item);if(seen.has(id))return false;seen.add(id);return true;});
}
