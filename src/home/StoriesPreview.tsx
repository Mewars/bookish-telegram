import {useEffect,useRef} from 'react';
import {supabase} from '../lib/supabase';
import '../../public/stories/preview.css';
export function StoriesPreview({city}:{city:string}){
 const root=useRef<HTMLElement>(null);
 const enabled=new URLSearchParams(window.location.search).get('stories')==='preview';
 useEffect(()=>{const node=root.current;if(!node)return;let disposed=false,cleanup:(()=>void)|undefined;
  const mount=async()=>{const module=enabled?await import('../../public/stories/preview.js'):await import('../../public/stories/live.js');if(disposed)return;cleanup='mountStoriesPreview' in module?module.mountStoriesPreview(node,{city,base:import.meta.env.BASE_URL}):supabase?module.mountCityStories(node,{city,client:supabase}):undefined;};
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void mount().catch(()=>{});}},{rootMargin:'200px'});observer.observe(node);
  return()=>{disposed=true;observer.disconnect();cleanup?.();};
 },[city,enabled]);
 return <section className="life-stories-slot" ref={root} aria-label={enabled?'Пример историй жителей':'Истории жителей'}/>;
}
