import type { Item } from '../types';

export const DEFAULT_EVENT_TIME_ZONE = 'Asia/Krasnoyarsk';
export function calendarDay(now: Date, timeZone = DEFAULT_EVENT_TIME_ZONE): string {
 const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(type=>parts.find(part=>part.type===type)!.value).join('-');
}
function dayNumber(value:string):number {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
 const time=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?time/86400000:NaN;
}
/** Absolute calendar dates are authoritative. Legacy offsets only support older local entries. */
export function eventOffset(item:Item, now=new Date()):number {
 if(item.kind!=='events')return NaN;
 if(!item.eventStart)return Number.isInteger(item.dateOffset)?item.dateOffset!:NaN;
 const first=dayNumber(item.eventStart),last=dayNumber(item.eventEnd??item.eventStart);
 const today=dayNumber(calendarDay(now,item.eventTimeZone));
 if(!Number.isFinite(first)||!Number.isFinite(last)||last<first)return NaN;
 return today>last?last-today:Math.max(0,first-today);
}
export function eventOnDay(item:Item,offset:number,now=new Date()):boolean {
 if(item.kind!=='events')return false;
 if(!item.eventStart)return item.dateOffset===offset;
 const target=dayNumber(calendarDay(now,item.eventTimeZone))+offset;
 return target>=dayNumber(item.eventStart)&&target<=dayNumber(item.eventEnd??item.eventStart);
}
export function currentEvents(items:Item[],now=new Date()):Item[] {
 return items.filter(item=>item.kind!=='events'||eventOffset(item,now)>=0)
  .map(item=>item.kind==='events'?{...item,dateOffset:eventOffset(item,now)}:item);
}
export function itemEventDate(item:Item,full=false):string {
 if(item.eventStart){
  const format=(value:string)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',day:'numeric',month:full?'long':'short',...(full?{weekday:'long' as const}:{})}).format(new Date(value+'T12:00:00Z'));
  if(item.eventEnd&&item.eventEnd!==item.eventStart)return `${format(item.eventStart)} — ${format(item.eventEnd)}`;
  return format(item.eventStart);
 }
 const offset=item.dateOffset??0;
 const date=new Date();date.setDate(date.getDate()+offset);
 if(!full&&offset===0)return 'Сегодня';if(!full&&offset===1)return 'Завтра';
 return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:full?'long':'short'}).format(date);
}
/** National calendar date, separate from local events: no invented venue or city celebration. */
export function holidaysToday(now=new Date(),timeZone=DEFAULT_EVENT_TIME_ZONE):{title:string;description:string;sourceUrl:string}[] {
 const day=calendarDay(now,timeZone),year=Number(day.slice(0,4));
 const lastSunday=new Date(Date.UTC(year,9,31));lastSunday.setUTCDate(31-lastSunday.getUTCDay());
 if(day!==lastSunday.toISOString().slice(0,10))return [];
 return [{title:'День автомобилиста',description:'День работника автомобильного и городского пассажирского транспорта. Поздравляем тех, кто за рулём!',sourceUrl:'https://www.calend.ru/holidays/0/0/164/'}];
}
