import {useEffect,useState} from 'react';
import {importedEvents,russianHolidays} from './feeds';
import {holidaysToday} from '../utils/events';
const EMPTY:unknown=null;
function useFeed(url:string){
 const [value,setValue]=useState<unknown>(EMPTY);
 useEffect(()=>{let active=true;const controller=new AbortController();
  const read=()=>fetch(url,{cache:'no-cache',signal:controller.signal}).then(response=>{if(!response.ok)throw Error('Feed unavailable');return response.json() as Promise<unknown>;}).then(result=>{if(active)setValue(result);}).catch(()=>{});
  void read();const timer=window.setInterval(()=>void read(),3600000);
  return()=>{active=false;controller.abort();window.clearInterval(timer);};
 },[url]);return value;
}
export function useImportedEvents(now:Date){return importedEvents(useFeed('/feeds/afisha-vk.json'),now);}
export function useRussianHolidays(now:Date,timeZone?:string){const value=useFeed('/feeds/calendar-ru.json');const items=russianHolidays(value,now,timeZone);return items.length?items:holidaysToday(now,timeZone);}
