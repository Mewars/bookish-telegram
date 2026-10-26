import {useEffect,useRef} from 'react';
import {supabase} from '../lib/supabase';
import {mountCityStories} from '../../public/stories/live.js';
import {mountStoriesPreview} from '../../public/stories/preview.js';
import '../../public/stories/preview.css';
export function StoriesPreview({city}:{city:string}){
 const root=useRef<HTMLElement>(null);
 const enabled=new URLSearchParams(window.location.search).get('stories')==='preview';
 useEffect(()=>{if(!root.current)return;if(enabled)return mountStoriesPreview(root.current,{city,base:import.meta.env.BASE_URL});if(supabase)return mountCityStories(root.current,{city,client:supabase});},[city,enabled]);
 return <section className="life-stories-slot" ref={root} aria-label={enabled?"Пример историй жителей":"Истории жителей"}/>;
}
