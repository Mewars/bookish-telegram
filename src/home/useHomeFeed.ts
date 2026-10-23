import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {emptyHomeFeed,loadHomeFeed} from './feed';
export function useHomeFeed(city:string){
 const [state,setState]=useState(()=>({feed:emptyHomeFeed(city),loading:true}));
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  void loadHomeFeed(supabase,city,controller.signal).then(feed=>{if(active)setState({feed,loading:false});}).catch(()=>{if(active)setState({feed:{...emptyHomeFeed(city),postsError:true,listingsError:true},loading:false});});
  return ()=>{active=false;controller.abort();};
 },[city]);
 return state.feed.city===city?state:{feed:emptyHomeFeed(city),loading:true};
}
