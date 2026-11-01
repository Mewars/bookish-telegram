import { useEffect, useState } from 'react';
/** Refresh an open page at its requested cadence and after returning to a suspended tab. */
export function useEventClock(refreshInterval=30000): Date {
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{
  const refresh=()=>setNow(new Date());
  const timer=window.setInterval(()=>{if(!document.hidden)refresh();},refreshInterval);
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[refreshInterval]);
 return now;
}
