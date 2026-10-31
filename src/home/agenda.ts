import type {Item} from '../types';
import {calendarDay,eventOnDay,DEFAULT_EVENT_TIME_ZONE} from '../utils/events';
export type AgendaPeriod='upcoming'|'tomorrow'|'weekend';
export function agendaEvents(items:Item[],period:AgendaPeriod,freeOnly:boolean,now:Date,timeZone=DEFAULT_EVENT_TIME_ZONE):Item[]{
 const weekday=new Date(calendarDay(now,timeZone)+'T12:00:00Z').getUTCDay();
 const saturday=weekday===0?-1:(6-weekday+7)%7;
 return items.filter(item=>item.kind==='events'&&(!freeOnly||/^(бесплатно|вход свободный|0\s*(₽|руб\.?|р\.?)?)$/i.test(item.price?.trim()??''))&&(
  period==='upcoming'||period==='tomorrow'&&eventOnDay(item,1,now)||period==='weekend'&&[saturday,saturday+1].some(day=>day>=0&&eventOnDay(item,day,now))
 )).sort((a,b)=>(a.dateOffset??0)-(b.dateOffset??0));
}
