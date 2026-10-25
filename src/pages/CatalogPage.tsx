import {currentEvents} from '../utils/events';
import {useEventClock} from '../hooks/useEventClock';
import { categoryParts, foodSubcategories, beautySections } from '../../public/catalog/taxonomy.js';
import type { Item, Kind } from '../types';
import { categories, sectionTitles } from '../data/catalog';
import { Card, type CardActions } from '../components/Card';
import { Search } from '../components/Search';
import { EmptyState } from '../components/EmptyState';
import { matches } from '../utils/search';
import { emptyCatalogFilters, matchesCatalogFilters, type CatalogFilters } from '../navigation/catalogRoute';
export function CatalogPage({ kind, city, filters, onFiltersChange, items: cityItems, addOrganization, catalogStatus, retryCatalog, ...actions }: CardActions & { kind: Kind; city: string; filters: CatalogFilters; onFiltersChange: (value: CatalogFilters) => void; items: Item[]; addOrganization?: () => void; catalogStatus?: 'loading' | 'ready' | 'fallback'; retryCatalog?: () => void }) {
 const now=useEventClock();
 cityItems=currentEvents(cityItems.filter(item=>item.city===city),now);
 const {query,category,subcategory,when}=filters;
 const change=(patch:Partial<CatalogFilters>)=>onFiltersChange({...filters,...patch});
 const setQuery=(value:string)=>change({query:value});
 const setCategory=(value:string)=>change({category:value,subcategory:'Все'});
 const setWhen=(value:string)=>change({when:value});
 const subtitles: Record<Kind,string>={events:`Подтверждённые события города ${city}.`,places:`Места и организации города ${city}.`,services:`Полезные организации и услуги города ${city}.`};
 const hasPublishedItems = cityItems.some(item => item.kind === kind);
 const items = cityItems.filter(item => item.kind === kind && matchesCatalogFilters(item,filters,now) && matches(item,query)).sort((a,b)=>kind==='events'?(a.dateOffset??0)-(b.dateOffset??0)||(a.time??'').localeCompare(b.time??''):0);
 const availableCategories = hasPublishedItems ? [...new Set([...categories[kind], ...cityItems.filter(item => item.kind === kind).map(item => categoryParts(item).category)])] : ['Все'];
 const subcategories=category==='Красота'?[...beautySections.map(sub=>sub.name),'Салоны красоты','Брови и ресницы']:category==='Кафе'?foodSubcategories.map(sub=>sub.name):[...new Set(cityItems.filter(item=>item.kind===kind && (category==='Все'||categoryParts(item).category===category)).map(item=>categoryParts(item).subcategory).filter(Boolean))];
 const reset = () => onFiltersChange({...emptyCatalogFilters});
 return <><div className="page-heading"><span className="eyebrow">ОТКРЫВАЙ · СОХРАНЯЙ · ПРОБУЙ</span><h1>{sectionTitles[kind]}</h1><p>{subtitles[kind]}</p>{addOrganization && <button className="primary-button organization-catalog-action" onClick={addOrganization}>Добавить организацию</button>}</div>{kind === 'places' && catalogStatus === 'loading' && <p className="organization-catalog-status" role="status">Обновляем каталог. Местные карточки уже доступны.</p>}{kind === 'places' && catalogStatus === 'fallback' && <div className="organization-catalog-status" role="status">Сервис организаций недоступен. Показан сохранённый каталог.<button className="back-link" onClick={retryCatalog}>Повторить</button></div>}<Search value={query} onChange={setQuery} placeholder={`Поиск: ${kind === 'events' ? 'название, событие, площадка' : kind === 'places' ? 'место, категория, адрес' : 'услуга, мастер, категория'}`}/><div className="filter-scroll" role="group" aria-label="Категории">{availableCategories.map(name => <button key={name} className={`chip ${name === category ? 'selected' : ''}`} aria-pressed={name === category} onClick={() => setCategory(name)}>{name}</button>)}</div>
 {subcategories.length>0 && <div className={category==='Красота'?'beauty-subcategories':'filter-scroll'} role="group" aria-label="Подкатегории">{['Все',...subcategories].map((name,index)=><button key={name} className={`${category==='Красота'?'beauty-category':'chip'} ${name===subcategory?'selected':''}`} aria-pressed={name===subcategory} onClick={()=>change({subcategory:name})}>{category==='Красота'&&index>0&&index<=4&&<span className={`beauty-category-image beauty-image-${index}`} aria-hidden="true"/>}{name}</button>)}{category==='Красота'&&<small className="beauty-image-caption">Тематические иллюстрации</small>}</div>}
 {kind === 'events' && hasPublishedItems && <div className="date-filter" role="group" aria-label="Дата события">{['Все даты', 'Сегодня', 'Завтра'].map(date => <button key={date} aria-pressed={date === when} className={date === when ? 'selected' : ''} onClick={() => setWhen(date)}>{date}</button>)}</div>}
 <div className="results-caption" aria-live="polite"><span>{items.length} {kind === 'events' ? 'событий' : kind === 'places' ? 'мест' : 'услуг'}</span><span>{kind === 'places' ? `Места · ${city}` : kind === 'events' ? `События · ${city}` : `Услуги · ${city}`}</span></div>
 {items.length ? <div className="card-grid">{items.map(item => <Card key={item.id} item={item} {...actions}/>)}</div> : !hasPublishedItems ? <EmptyState title={kind === 'events' ? 'Афиша пока пуста' : kind === 'services' ? 'Услуги скоро появятся' : 'Места скоро появятся'} text={kind === 'events' ? `Добавим сюда только подтверждённые события города ${city}.` : kind === 'services' ? 'Добавим сюда только реальные услуги и исполнителей.' : 'Проверяем сведения о местах перед публикацией.'}/> : <EmptyState title="Здесь пока тихо" text="Смените категорию или попробуйте другой запрос." action="Сбросить фильтры" onAction={reset}/>}
 </>;
}
