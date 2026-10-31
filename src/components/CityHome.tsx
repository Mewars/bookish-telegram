import {StoriesPreview} from '../home/StoriesPreview';
import {wallBodyPreview} from '../../host-public/wall/expressions.js';
import { useEffect, useRef, useState } from 'react';
import type { Item, Section } from '../types';
import { Card, type CardActions } from './Card';
import { isFoodVenue, isCulturalPlace, isShop, isService, isTodayRecommendation } from './homeDiscovery';
import { Search } from './Search';
import { EmptyState } from './EmptyState';
import { Icon, type IconName } from './Icon';
import { MediaImage } from './MediaImage';
import type { DirectoryCity } from '../data/cities';
import { matches } from '../utils/search';
import { catalogHash, emptyCatalogFilters, hashParts, readCatalogFilters, rememberHomeSearch } from '../navigation/catalogRoute';
import { catalogGroups } from '../../public/catalog/taxonomy.js';
import { useHomeFeed } from '../home/useHomeFeed';
import { itemEventDate, currentEvents } from '../utils/events';
import {useEventClock} from '../hooks/useEventClock';
import { homePrice, hostSectionHref } from '../home/feed';
import {useRussianHolidays} from '../events/useCityFeeds';
import '../home/home-life.css';
import '../home/editorial.css';
import '../home/today.css';
import {agendaEvents,type AgendaPeriod} from '../home/agenda';

// These filters remain available to existing category-panel navigation.
function homeShortcuts():{label:string;matches:(item:Item)=>boolean}[]{return [
 {label:'Сегодня',matches:item=>isTodayRecommendation(item)},
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
  <span className="life-place-body"><small>{item.category}</small><strong>{item.title}</strong><span>{item.kind==='events'?`${itemEventDate(item)}${item.time?' · '+item.time:''}`:item.address||'Адрес уточняется'}</span><Icon name="arrow" size={18}/></span>
 </button>;
}
export function CityHome({city,cityProfile,items,navigate,...actions}:CardActions&{city:string;cityProfile?:DirectoryCity;items:Item[];navigate:(section:Section)=>void}){
 const [query,setQuery]=useState(()=>readCatalogFilters(window.location.hash).query);
 const [discovery,setDiscovery]=useState<string|null>(null);
 const [categoriesOpen,setCategoriesOpen]=useState(false);
 const categoryDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=categoryDialog.current;if(categoriesOpen)dialog?.showModal();else dialog?.close();},[categoriesOpen]);
 useEffect(()=>{const sync=()=>{if(hashParts(window.location.hash).section==='home')setQuery(readCatalogFilters(window.location.hash).query);};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
 useEffect(()=>{rememberHomeSearch(city,query);},[city,query]);
 const [agendaPeriod,setAgendaPeriod]=useState<AgendaPeriod>('upcoming');
 const [freeOnly,setFreeOnly]=useState(false);
 const {feed,loading}=useHomeFeed(city);
 const now=useEventClock();
 const cityItems=currentEvents(items.filter(item=>item.city===city),now);
 const holidays=useRussianHolidays(now,cityProfile?.timeZone);
 const selected=homeShortcuts().find(x=>x.label===discovery);
 const results=cityItems.filter(item=>matches(item,query)&&(!selected||selected.matches(item)));
 const searching=!!query.trim()||!!selected;
 const showResults=()=>window.requestAnimationFrame(()=>document.getElementById('city-selections')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
 const chooseDiscovery=(label:string)=>{setQuery('');setDiscovery(label);showResults();};
 const categories=()=>{const host=window as Window&{ryadomOpenCategories?:()=>void};if(host.ryadomOpenCategories)host.ryadomOpenCategories();else setCategoriesOpen(true);};
 const branchHref=(name:string)=>{const branch=catalogGroups.flatMap(g=>g.items).find(b=>b.name===name);if(branch?.url)return branch.url+'?'+new URLSearchParams({city});if(branch?.name==='Афиша')return catalogHash('events',city);if(branch?.catalogCategory)return catalogHash('places',city,{...emptyCatalogFilters,category:branch.catalogCategory});return '#/home?'+new URLSearchParams({city,q:branch?.term||name});};
 const allEvents=cityItems.filter(item=>item.kind==='events');
 const events=agendaEvents(allEvents,agendaPeriod,freeOnly,now,cityProfile?.timeZone).slice(0,3);
 const gigs=feed.gigs;
 const listings=feed.listings.filter(item=>!['gig_offer','gig_seek'].includes(item.deal_type));
 return <div className="city-home home-life home-editorial home-today">
  <section className="city-cover city-cover--no-image" aria-labelledby="city-cover-title">
   <div className="city-cover-content">
    <span className="today-city-label"><Icon name="pin" size={17}/><h1 id="city-cover-title">{city}</h1></span>
    <h2 className="today-title">Сегодня рядом</h2>
    <p className="cover-summary">{cityProfile?.summary||'События, помощь и люди твоего города.'}</p>
    <form className="cover-search" role="search" onSubmit={e=>{e.preventDefault();showResults();}}>
     <Search value={query} onChange={setQuery} placeholder={`Что найти в городе ${city}?`}/><button className="cover-search-action" type="submit" aria-label="Показать результаты поиска"><span>Найти</span><Icon name="arrow" size={20}/></button>
    </form>
    <div className="quick-discovery" role="group" aria-label="Быстрые сценарии">
     <button onClick={()=>navigate('events')}><Icon name="events" size={19}/>Афиша</button>
     <a href={hostSectionHref('classifieds',city,{mode:'haltura'})}><Icon name="services" size={19}/>Халтура</a>
     <a href={hostSectionHref('wall',city)}><Icon name="profile" size={19}/>Стена города</a>
     <button onClick={()=>chooseDiscovery('Сегодня')} aria-pressed={discovery==='Сегодня'}><Icon name="sun" size={19}/>Сегодня</button>
     <button id="ryadom-category-trigger" className="life-categories-button" onClick={categories} aria-haspopup="dialog"><Icon name="search" size={19}/>Все категории<Icon name="arrow" size={18}/></button>
    </div>
   </div>
  </section>
  <div id="city-selections" className="life-content">
   {searching?<section className="city-section life-search-results"><div className="life-heading"><div><h2>{selected?.label||'Нашлось рядом'}</h2><p role="status">Найдено: {results.length}</p></div><button onClick={()=>{setQuery('');setDiscovery(null);}}>Сбросить<Icon name="close" size={16}/></button></div>{selected?.label==='Сегодня'&&<><p className="today-schedule-note">События на сегодня · время местное. Прошедшие даты скрываются автоматически.</p>{holidays.map(holiday=><aside className="today-holiday" key={holiday.title}><Icon name="sun" size={28}/><div><small>Сегодня в календаре</small><h3>{holiday.title}</h3><p>{holiday.description}</p><a href={holiday.sourceUrl} target="_blank" rel="noopener noreferrer">О празднике<Icon name="arrow" size={15}/></a></div></aside>)}</>}{results.length?<div className="card-grid">{results.map(item=><Card key={item.id} item={item} {...actions}/>)}</div>:<EmptyState title={selected?.label==='Сегодня'?'На сегодня событий пока нет':'Ничего не найдено'} text={selected?.label==='Сегодня'?'Посмотрите ближайшие события в афише.':'Попробуйте изменить запрос или открыть все категории.'} action={selected?.label==='Сегодня'?'Вся афиша':'Все категории'} onAction={selected?.label==='Сегодня'?()=>navigate('events'):categories}/>}</section>:<>
    <div className={`today-overview${allEvents.length&&gigs.length?' today-overview--pair':''}`}>
     {allEvents.length>0&&<section className="today-panel" aria-label="Афиша города"><SectionHeading title="Куда сходить" href={catalogHash('events',city)} label="Вся афиша"/>
      <div className="today-filters" role="group" aria-label="Даты ближайших событий">{([['upcoming','Ближайшее'],['tomorrow','Завтра'],['weekend','Выходные']] as const).map(([value,label])=><button key={value} onClick={()=>setAgendaPeriod(value)} aria-pressed={agendaPeriod===value}>{label}</button>)}<button onClick={()=>setFreeOnly(!freeOnly)} aria-pressed={freeOnly}>Бесплатно</button></div>
      <div aria-live="polite">{events.length>0?<div className="life-events">{events.map(item=><PlacePreview key={item.id} item={item} open={actions.open}/>)}</div>:<p className="today-empty">В этой подборке событий пока нет. Посмотрите другие даты в афише.</p>}</div>
     </section>}
     {gigs.length>0&&<section className="today-panel" aria-label="Свежие задания"><SectionHeading title="Халтура рядом" href={hostSectionHref('classifieds',city,{mode:'haltura'})} label="Все задания"/><div className="today-gigs">{gigs.map(item=><a className="today-gig" key={item.id} href={hostSectionHref('classifieds',city,{mode:'haltura',ad:item.id})}><span><strong>{item.title}</strong><small>{item.deal_type==='gig_seek'?'Ищу подработку':'Нужна помощь'} · {city}</small></span><b>{homePrice(item)}</b></a>)}</div><a className="today-primary" href={hostSectionHref('classifieds',city,{mode:'haltura',view:'new'})}>Предложить задание<Icon name="arrow" size={18}/></a></section>}
    </div>
    <section className="life-section" aria-label="Места и организации"><div className="life-heading"><h2>Места и организации</h2><button onClick={categories}>Все категории<Icon name="arrow" size={18}/></button></div><div className="life-useful">{useful.map(branch=><a key={branch.name} href={branchHref(branch.name)}><Icon name={branch.icon} size={24}/><span>{branch.label}</span><Icon name="arrow" size={16}/></a>)}</div></section>
    <StoriesPreview city={city}/>
    <div className="life-city-row">
     <section className="life-city-today" aria-label="Город сегодня"><SectionHeading title="Город сегодня" href={hostSectionHref('wall',city)} label="Вся стена"/><a className="life-suggest-news" href={hostSectionHref('wall',city,{view:'write'})}>+ Предложить новость</a>
      {loading?<p className="life-state" role="status">Загружаем городскую ленту…</p>:feed.posts.length?<div className="life-posts">{feed.posts.map(post=><a key={post.id} className="life-post" href={hostSectionHref('wall',city,{post:post.id})}><span className="life-post-icon"><Icon name={post.post_type==='question'?'profile':'home'} size={26}/></span><div><small>{post.post_type==='news'?'Новости города':post.post_type==='question'?'Вопрос жителя':'Городская стена'}</small><h3>{post.title}</h3><p>{wallBodyPreview(post.body)}</p></div><Icon name="arrow" size={20}/></a>)}</div>:<div className="life-welcome"><span className="life-eyebrow">ЛЮДИ · ИДЕИ · ОБЩЕНИЕ</span><h3>Город начинается с нас</h3><p>{feed.postsError?'Не удалось загрузить записи. Откройте городскую стену или попробуйте позже.':'Поделитесь новостью, задайте вопрос или расскажите о любимом месте.'}</p><a href={hostSectionHref('classifieds',city,{mode:'haltura'})}><Icon name="services" size={25}/><span><strong>Халтура рядом</strong><small>Найти подработку или помощь</small></span><Icon name="arrow" size={18}/></a><a href={hostSectionHref('wall',city,{view:'write'})}>Предложить запись<Icon name="arrow" size={18}/></a></div>}
     </section>
     <aside className="life-actions" aria-labelledby="life-actions-title"><h2 id="life-actions-title">Быстрые действия</h2><a href={hostSectionHref('classifieds',city,{view:'new'})}><Icon name="shop" size={25}/><span><strong>Подать объявление</strong><small>Продать, купить, найти нужное</small></span><Icon name="arrow" size={18}/></a><a href={'#/add-organization?'+new URLSearchParams({city})}><Icon name="places" size={25}/><span><strong>Добавить организацию</strong><small>Рассказать о своём деле</small></span><Icon name="arrow" size={18}/></a><a href={hostSectionHref('classifieds',city,{mode:'haltura'})}><Icon name="services" size={25}/><span><strong>Халтура рядом</strong><small>Найти подработку или помощь</small></span><Icon name="arrow" size={18}/></a><a href={hostSectionHref('wall',city,{view:'write'})}><Icon name="profile" size={25}/><span><strong>Задать вопрос</strong><small>Спросить у жителей города</small></span><Icon name="arrow" size={18}/></a></aside>
    </div>
    <section className="life-business"><Icon name="shop" size={42}/><div><h2>Ваше дело — часть города</h2><p>Бесплатное размещение, помощь с оформлением и поддержка вашей карточки.</p></div><div className="life-business-actions"><a className="home-add-organization" href={'#/business?'+new URLSearchParams({city})}>Бизнесу<Icon name="arrow" size={19}/></a></div></section>
    {listings.length>0&&<section className="life-section" aria-label="Свежие объявления"><SectionHeading title="Объявления рядом" href={hostSectionHref('classifieds',city)} label="Все объявления"/><div className="life-listings" data-count={listings.length}>{listings.map(item=><a key={item.id} className="life-listing" href={hostSectionHref('classifieds',city,{ad:item.id})}><span className="life-listing-image"><MediaImage src={item.image} alt={item.title}/></span><div><small>{item.category}</small><h3>{item.title}</h3><strong>{homePrice(item)}</strong><span className="life-listing-more">Подробнее<Icon name="arrow" size={18}/></span></div></a>)}</div></section>}
   </>}
  </div>
  <dialog ref={categoryDialog} className="life-category-dialog" aria-label="Все категории" onCancel={()=>setCategoriesOpen(false)}><button onClick={()=>setCategoriesOpen(false)} aria-label="Закрыть категории"><Icon name="close"/></button><h2>Город под рукой</h2>{catalogGroups.map(group=><div key={group.title}><h3>{group.title}</h3>{group.items.map(branch=><a key={branch.name} href={branchHref(branch.name)} onClick={()=>setCategoriesOpen(false)}>{branch.name}<Icon name="arrow" size={16}/></a>)}</div>)}</dialog>
 </div>;
}
