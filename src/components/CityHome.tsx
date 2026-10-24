import { useEffect, useRef, useState } from 'react';
import type { Item, Section } from '../types';
import { Card, type CardActions } from './Card';
import { isFoodVenue, isCulturalPlace, isShop, isService, isTodayRecommendation, weekdayInCity } from './homeDiscovery';
import { Search } from './Search';
import { EmptyState } from './EmptyState';
import { Icon, type IconName } from './Icon';
import { MediaImage } from './MediaImage';
import { getCityCover } from '../data/cityCover';
import type { DirectoryCity } from '../data/cities';
import { matches } from '../utils/search';
import { catalogHash, emptyCatalogFilters, hashParts, readCatalogFilters, rememberHomeSearch } from '../navigation/catalogRoute';
import { catalogGroups } from '../../public/catalog/taxonomy.js';
import { useHomeFeed } from '../home/useHomeFeed';
import { eventDate } from '../utils/date';
import { homePrice, hostSectionHref } from '../home/feed';
import '../home/home-life.css';

// These filters remain available to existing category-panel navigation.
function homeShortcuts(today:number):{label:string;matches:(item:Item)=>boolean}[]{return [
 {label:'Сегодня',matches:item=>isTodayRecommendation(item,today)},
 {label:'Поесть',matches:isFoodVenue},{label:'Культура',matches:isCulturalPlace},
 {label:'Магазины',matches:isShop},{label:'Услуги',matches:isService},
];}
const useful:{name:string;label:string;icon:IconName}[]=[
 {name:'Аптеки',label:'Аптеки',icon:'heart'},{name:'Услуги и мастера',label:'Услуги и мастера',icon:'services'},
 {name:'Пункты выдачи',label:'Пункты выдачи',icon:'shop'},{name:'Магазины',label:'Магазины',icon:'shop'},
 {name:'Где поесть',label:'Кафе и рестораны',icon:'places'},{name:'Образование и молодёжь',label:'Образование',icon:'profile'},
 {name:'Парки и прогулки',label:'Парки и прогулки',icon:'sun'},{name:'Культура',label:'Культура',icon:'events'},
];
function SectionHeading({title,href,label='Смотреть все'}:{title:string;href:string;label?:string}){
 return <div className="life-heading"><h2>{title}</h2><a href={href}>{label}<Icon name="arrow" size={18}/></a></div>;
}
function PlacePreview({item,open}:Pick<CardActions,'open'>&{item:Item}){
 return <button className="life-place" onClick={()=>open(item)} aria-label={`Подробнее: ${item.title}`}>
  <span className="life-place-image"><MediaImage src={item.image} alt={item.title}/>{item.photoIllustrative&&<small className="life-photo-label">Фото-иллюстрация</small>}</span>
  <span className="life-place-body"><small>{item.category}</small><strong>{item.title}</strong><span>{item.kind==='events'?`${eventDate(item.dateOffset)}${item.time?' · '+item.time:''}`:item.address||item.description}</span><Icon name="arrow" size={18}/></span>
 </button>;
}
export function CityHome({city,cityProfile,items,navigate,...actions}:CardActions&{city:string;cityProfile?:DirectoryCity;items:Item[];navigate:(section:Section)=>void}){
 useEffect(()=>{
  const cover=document.querySelector<HTMLElement>('.city-home > .city-cover');if(!cover)return;
  const size=()=>{const top=cover.getBoundingClientRect().top+window.scrollY;cover.style.setProperty('--home-cover-height',`${Math.max(window.innerWidth<700&&window.innerHeight<=740?420:540,window.innerHeight-Math.max(0,top))}px`);};
  size();window.addEventListener('resize',size);const observer=new ResizeObserver(size);
  const header=document.querySelector('.web-header,.app-header');if(header)observer.observe(header);
  return ()=>{window.removeEventListener('resize',size);observer.disconnect();};
 },[]);
 const [query,setQuery]=useState(()=>readCatalogFilters(window.location.hash).query);
 const [discovery,setDiscovery]=useState<string|null>(null);
 const [categoriesOpen,setCategoriesOpen]=useState(false);
 const categoryDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=categoryDialog.current;if(categoriesOpen)dialog?.showModal();else dialog?.close();},[categoriesOpen]);
 useEffect(()=>{const sync=()=>{if(hashParts(window.location.hash).section==='home')setQuery(readCatalogFilters(window.location.hash).query);};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
 useEffect(()=>{rememberHomeSearch(city,query);},[city,query]);
 const cover=getCityCover(city,cityProfile?.cover_url);
 const {feed,loading}=useHomeFeed(city);
 const cityItems=items.filter(item=>item.city===city);
 const selected=homeShortcuts(weekdayInCity(new Date())).find(x=>x.label===discovery);
 const results=cityItems.filter(item=>matches(item,query)&&(!selected||selected.matches(item)));
 const searching=!!query.trim()||!!selected;
 const showResults=()=>window.requestAnimationFrame(()=>document.getElementById('city-selections')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
 const chooseDiscovery=(label:string)=>{setQuery('');setDiscovery(label);showResults();};
 const categories=()=>{const host=window as Window&{ryadomOpenCategories?:()=>void};if(host.ryadomOpenCategories)host.ryadomOpenCategories();else setCategoriesOpen(true);};
 const branchHref=(name:string)=>{const branch=catalogGroups.flatMap(g=>g.items).find(b=>b.name===name);if(branch?.url)return branch.url+'?'+new URLSearchParams({city});if(branch?.name==='Афиша')return catalogHash('events',city);if(branch?.catalogCategory)return catalogHash('places',city,{...emptyCatalogFilters,category:branch.catalogCategory});return '#/home?'+new URLSearchParams({city,q:branch?.term||name});};
 const events=cityItems.filter(item=>item.kind==='events'&&typeof item.dateOffset==='number'&&item.dateOffset>=0).sort((a,b)=>(a.dateOffset??0)-(b.dateOffset??0)).slice(0,3);
 const collections=[
  {title:'На прогулку',text:'Парки, набережные и места для неспешного дня',category:'Парки и прогулки',match:(x:Item)=>/парк|набережн|прогулк/i.test(x.category)},
  {title:'Кофе и встречи',text:'Найти место для разговора и небольшой паузы',category:'Где поесть',match:isFoodVenue},
  {title:'История и культура',text:'Узнать город через его места и истории',category:'Культура',match:isCulturalPlace},
 ].map(group=>({...group,item:cityItems.find(x=>group.match(x)&&x.image&&!x.photoIllustrative&&!/\.svg(?:[?#]|$)/i.test(x.image))}));
 return <div className="city-home home-life">
  <section className={`city-cover${cover?'':' city-cover--no-image'}${city.length>10?' city-cover--long-name':''}`} aria-labelledby="city-cover-title">
   <div className={`cover-image${cover?'':' cover-image--neutral'}`}>{cover&&<MediaImage src={cover.src} alt={cover.alt} eager/>}</div><div className="cover-atmosphere" aria-hidden="true"/>
   <div className="city-cover-content">
    <span className="life-eyebrow">РЯДОМ</span>
    <h1 id="city-cover-title">{city}</h1>
    <p className="life-cover-tagline">Твой город. <em>Твои возможности.</em></p>
    <p className="cover-summary">{cityProfile?.summary||'Находи нужное, общайся и будь в курсе жизни города.'}</p>
    <form className="cover-search" role="search" onSubmit={e=>{e.preventDefault();showResults();}}>
     <Search value={query} onChange={setQuery} placeholder={`Что найти в городе ${city}?`}/><button className="cover-search-action" type="submit" aria-label="Показать результаты поиска"><span>Найти</span><Icon name="arrow" size={20}/></button>
    </form>
    <div className="quick-discovery" role="group" aria-label="Быстрые сценарии">
     <button onClick={()=>navigate('events')}><Icon name="events" size={19}/>Афиша</button>
     <a href={hostSectionHref('classifieds',city)}><Icon name="shop" size={19}/>Объявления</a>
     <a href={hostSectionHref('wall',city)}><Icon name="profile" size={19}/>Стена города</a>
     <button onClick={()=>chooseDiscovery('Сегодня')} aria-pressed={discovery==='Сегодня'}><Icon name="sun" size={19}/>Сегодня</button>
    </div>
    <button id="ryadom-category-trigger" className="life-categories-button" onClick={categories} aria-haspopup="dialog"><Icon name="search" size={19}/>Все категории<Icon name="arrow" size={18}/></button>
   </div>
   <span className="life-cover-caption">{cityProfile?.region||city}<span>Открывай город по-новому</span></span>
  </section>
  <div id="city-selections" className="life-content">
   {searching?<section className="city-section life-search-results"><div className="life-heading"><div><h2>{selected?.label||'Нашлось рядом'}</h2><p role="status">Найдено: {results.length}</p></div><button onClick={()=>{setQuery('');setDiscovery(null);}}>Сбросить<Icon name="close" size={16}/></button></div>{selected?.label==='Сегодня'&&<p className="today-schedule-note">Места показаны по заявленному расписанию. Перед посещением уточняйте часы работы.</p>}{results.length?<div className="card-grid">{results.map(item=><Card key={item.id} item={item} {...actions}/>)}</div>:<EmptyState title="Ничего не найдено" text="Попробуйте изменить запрос или открыть все категории." action="Все категории" onAction={categories}/>}</section>:<>
    <div className="life-city-row">
     <section className="life-city-today" aria-label="Город сегодня"><SectionHeading title="Город сегодня" href={hostSectionHref('wall',city)} label="Вся стена"/>
      {loading?<p className="life-state" role="status">Загружаем городскую ленту…</p>:feed.posts.length?<div className="life-posts">{feed.posts.map(post=><a key={post.id} className="life-post" href={hostSectionHref('wall',city,{post:post.id})}><span className="life-post-icon"><Icon name={post.post_type==='question'?'profile':'home'} size={26}/></span><div><small>{post.post_type==='news'?'Новости города':post.post_type==='question'?'Вопрос жителя':'Городская стена'}</small><h3>{post.title}</h3><p>{post.body}</p></div><Icon name="arrow" size={20}/></a>)}</div>:<div className="life-welcome"><span className="life-eyebrow">ЛЮДИ · ИДЕИ · ОБЩЕНИЕ</span><h3>Город начинается с нас</h3><p>{feed.postsError?'Не удалось загрузить записи. Откройте городскую стену или попробуйте позже.':'Поделитесь новостью, задайте вопрос или расскажите о любимом месте.'}</p><a href={hostSectionHref('wall',city,{view:'write'})}>Предложить запись<Icon name="arrow" size={18}/></a></div>}
     </section>
     <aside className="life-actions" aria-labelledby="life-actions-title"><h2 id="life-actions-title">Быстрые действия</h2><a href={hostSectionHref('classifieds',city,{view:'new'})}><Icon name="shop" size={25}/><span><strong>Подать объявление</strong><small>Продать, купить, найти нужное</small></span><Icon name="arrow" size={18}/></a><a href={'#/add-organization?'+new URLSearchParams({city})}><Icon name="places" size={25}/><span><strong>Добавить организацию</strong><small>Рассказать о своём деле</small></span><Icon name="arrow" size={18}/></a><a href={hostSectionHref('wall',city,{view:'write'})}><Icon name="profile" size={25}/><span><strong>Задать вопрос</strong><small>Спросить у жителей города</small></span><Icon name="arrow" size={18}/></a></aside>
    </div>
    {feed.listings.length>0&&<section className="life-section" aria-label="Свежие объявления"><SectionHeading title="Объявления рядом" href={hostSectionHref('classifieds',city)} label="Все объявления"/><div className="life-listings">{feed.listings.map(item=><a key={item.id} className="life-listing" href={hostSectionHref('classifieds',city,{ad:item.id})}><span className="life-listing-image"><MediaImage src={item.image} alt={item.title}/></span><div><small>{item.category}</small><h3>{item.title}</h3><strong>{homePrice(item)}</strong></div></a>)}</div></section>}
    {events.length>0&&<section className="life-section" aria-label="Афиша города"><SectionHeading title="Куда сходить" href={catalogHash('events',city)} label="Вся афиша"/><div className="life-events">{events.map(item=><PlacePreview key={item.id} item={item} open={actions.open}/>)}</div></section>}
    {collections.some(group=>group.item)&&<section className="life-section" aria-label="Открывай город по-новому"><SectionHeading title="Открывай город по-новому" href={catalogHash('places',city)} label="Все места"/><div className="life-collections">{collections.filter(group=>group.item).map(group=><a className="life-collection" key={group.title} href={branchHref(group.category)}><MediaImage src={group.item!.image} alt=""/><span><h3>{group.title}</h3><p>{group.text}</p></span><Icon name="arrow" size={23}/></a>)}</div></section>}
    <section className="life-section" aria-label="Нужное рядом"><div className="life-heading"><h2>Нужное рядом</h2><button onClick={categories}>Все категории<Icon name="arrow" size={18}/></button></div><div className="life-useful">{useful.map(branch=><a key={branch.name} href={branchHref(branch.name)}><Icon name={branch.icon} size={24}/><span>{branch.label}</span><Icon name="arrow" size={16}/></a>)}</div></section>
    <section className="life-business"><Icon name="shop" size={42}/><div><h2>Ваше дело — часть города</h2><p>Добавьте организацию: после проверки она появится в своём разделе каталога.</p></div><a className="home-add-organization" href={'#/add-organization?'+new URLSearchParams({city})}>Добавить организацию<Icon name="arrow" size={19}/></a></section>
   </>}
  </div>
  <dialog ref={categoryDialog} className="life-category-dialog" aria-label="Все категории" onCancel={()=>setCategoriesOpen(false)}><button onClick={()=>setCategoriesOpen(false)} aria-label="Закрыть категории"><Icon name="close"/></button><h2>Город под рукой</h2>{catalogGroups.map(group=><div key={group.title}><h3>{group.title}</h3>{group.items.map(branch=><a key={branch.name} href={branchHref(branch.name)} onClick={()=>setCategoriesOpen(false)}>{branch.name}<Icon name="arrow" size={16}/></a>)}</div>)}</dialog>
 </div>;
}
