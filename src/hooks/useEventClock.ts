import { useEffect, useState } from 'react';
/** Refresh an open page after local midnight and after returning to a suspended tab. */
export function useEventClock(): Date {
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{
  const refresh=()=>setNow(new Date());
  const timer=window.setInterval(refresh,30000);
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 return now;
}
