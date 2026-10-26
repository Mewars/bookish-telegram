import {calendarDay} from '../utils/events';
export const officialNewsSources:Record<string,{name:string;url:string;feed:string}>={
 'Енисейск':{name:'Администрация Енисейска',url:'https://eniseysk.gosuslugi.ru/dlya-zhiteley/novosti-i-reportazhi/',feed:'/news/eniseysk.json'},
};
export interface OfficialHeadline {title:string;date:string;url:string}
export function officialHeadlines(value:unknown,city:string,now=new Date()):OfficialHeadline[]{
 const source=officialNewsSources[city];
 if(!source||!value||typeof value!=='object')return [];
 const feed=value as Record<string,unknown>;
 if(feed.city!==city||feed.sourceUrl!==source.url||typeof feed.checkedAt!=='string'||!Array.isArray(feed.items))return [];
 const age=now.getTime()-Date.parse(feed.checkedAt);
 if(!Number.isFinite(age)||age< -600000||age>7*86400000)return [];
 const seen=new Set<string>();
 return feed.items.flatMap((entry:unknown)=>{
  if(!entry||typeof entry!=='object')return [];
  const {title,date,url}=entry as Record<string,unknown>;
  if(typeof title!=='string'||title.trim().length<5||title.length>350||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>calendarDay(now)||typeof url!=='string')return [];
  const dateTime=Date.parse(date+'T12:00:00Z');
  if(!Number.isFinite(dateTime)||new Date(dateTime).toISOString().slice(0,10)!==date)return [];
  if(!/^https:\/\/eniseysk\.gosuslugi\.ru\/dlya-zhiteley\/novosti-i-reportazhi\/novosti_\d+\.html$/.test(url)||seen.has(url))return [];
  seen.add(url);return [{title:title.trim(),date,url}];
 }).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
}
