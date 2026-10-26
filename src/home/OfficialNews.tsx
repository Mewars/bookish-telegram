import {useEffect,useState} from 'react';
import {Icon} from '../components/Icon';
import {officialHeadlines,officialNewsSources,type OfficialHeadline} from './officialNews';
export function OfficialNews({city}:{city:string}){
 const source=officialNewsSources[city];
 const [loaded,setLoaded]=useState<{city:string;items:OfficialHeadline[]}>({city:'',items:[]});
 useEffect(()=>{
  if(!source)return;
  let active=true;
  const read=()=>fetch(source.feed,{signal:AbortSignal.timeout(10000),cache:'no-cache'})
   .then(response=>{if(!response.ok)throw new Error('News unavailable');return response.json() as Promise<unknown>;})
   .then(value=>{if(active)setLoaded({city,items:officialHeadlines(value,city)});})
   .catch(()=>{if(active)setLoaded({city,items:[]});});
  void read();const timer=window.setInterval(()=>void read(),3600000);
  return()=>{active=false;window.clearInterval(timer);};
 },[city,source]);
 if(!source)return null;
 const items=loaded.city===city?loaded.items:[];
 return <section className="life-section official-news" aria-label="Новости администрации">
  <div className="life-heading"><h2>Новости города</h2><a href={source.url} target="_blank" rel="noopener noreferrer">Все новости<Icon name="arrow" size={18}/></a></div>
  <p className="official-news-source">Источник: {source.name}</p>
  {items.length?<div className="official-news-grid">{items.map(item=><a className="official-news-item" key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"><time dateTime={item.date}>{new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(item.date+'T12:00:00Z'))}</time><h3>{item.title}</h3><span>Читать в источнике<Icon name="arrow" size={15}/></span></a>)}</div>:<p className="official-news-empty">Последние публикации доступны на сайте администрации.</p>}
 </section>;
}
