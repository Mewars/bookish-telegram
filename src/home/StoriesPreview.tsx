import {useEffect,useRef} from 'react';
import {mountStoriesPreview} from '../../public/stories/preview.js';
import '../../public/stories/preview.css';
export function StoriesPreview({city}:{city:string}){
 const root=useRef<HTMLElement>(null);
 const enabled=new URLSearchParams(window.location.search).get('stories')==='preview';
 useEffect(()=>{if(enabled&&root.current)return mountStoriesPreview(root.current,{city,base:import.meta.env.BASE_URL});},[city,enabled]);
 return enabled?<section ref={root} aria-label="Пример историй жителей"/>:null;
}
