import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {emptyHomeFeed,loadHomeFeed} from './feed';

// Private Storage links are signed for 10 minutes. Refresh them before expiry
// even if someone leaves the homepage open, or returns after a background pause.
export const HOME_PHOTO_REFRESH_MS=8*60*1000;
const HOME_PHOTO_ERROR_RETRY_MS=30*1000;

export function useHomeFeed(city:string){
 const [state,setState]=useState(()=>({feed:emptyHomeFeed(city),loading:true}));
 const [revision,setRevision]=useState(0);
 const refreshedAt=useRef(Date.now());
 const retriedErrorAt=useRef(0);

 useEffect(()=>{
  refreshedAt.current=Date.now();
  const refreshIfDue=()=>{
   if(document.visibilityState!=='visible'||Date.now()-refreshedAt.current<HOME_PHOTO_REFRESH_MS)return;
   refreshedAt.current=Date.now();
   setRevision(value=>value+1);
  };
  const timer=window.setInterval(refreshIfDue,60*1000);
  window.addEventListener('focus',refreshIfDue);
  document.addEventListener('visibilitychange',refreshIfDue);
  return ()=>{
   window.clearInterval(timer);
   window.removeEventListener('focus',refreshIfDue);
   document.removeEventListener('visibilitychange',refreshIfDue);
  };
 },[city]);

 const retryPhoto=useCallback(()=>{
  // A lazy image can be fetched after its URL expires. Retry once per cooldown,
  // never spin endlessly if Storage or the network is unavailable.
  if(document.visibilityState!=='visible')return;
  const now=Date.now();
  if(now-retriedErrorAt.current<HOME_PHOTO_ERROR_RETRY_MS)return;
  retriedErrorAt.current=now;
  refreshedAt.current=now;
  setRevision(value=>value+1);
 },[]);

 useEffect(()=>{
  const controller=new AbortController();let active=true;
  // Keep already-displayed images intact during a background URL refresh.
  const progressive=revision===0?(feed:ReturnType<typeof emptyHomeFeed>)=>{
   if(active)setState({feed,loading:false});
  }:undefined;
  void loadHomeFeed(supabase,city,controller.signal,progressive)
   .then(feed=>{if(active)setState({feed,loading:false});})
   .catch(()=>{if(active)setState({feed:{...emptyHomeFeed(city),postsError:true,listingsError:true},loading:false});});
  return ()=>{active=false;controller.abort();};
 },[city,revision]);
 const visible=state.feed.city===city?state:{feed:emptyHomeFeed(city),loading:true};
 return {...visible,retryPhoto};
}
