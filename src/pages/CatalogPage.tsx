import { useState } from 'react';
import type { Kind } from '../types';
import { catalog, categories, sectionTitles } from '../data/catalog';
import { Card, type CardActions } from '../components/Card';
import { Search } from '../components/Search';
import { EmptyState } from '../components/EmptyState';
import { matches } from '../utils/search';
const subtitles: Record<Kind, string> = { events: 'Твои маленькие поводы выйти из дома.', places: 'Найди своё место в знакомом городе.', services: 'Люди рядом, которые умеют помогать.' };
export function CatalogPage({ kind, ...actions }: CardActions & { kind: Kind }) {
 const [query, setQuery] = useState(''); const [category, setCategory] = useState('Все');
 const [when, setWhen] = useState('Все даты');
 const items = catalog.filter(item => item.kind === kind && (category === 'Все' || item.category === category) && matches(item, query) && (kind !== 'events' || when === 'Все даты' || item.dateOffset === (when === 'Сегодня' ? 0 : 1)));
 const reset = () => { setQuery(''); setCategory('Все'); setWhen('Все даты'); };
 return <><div className="page-heading"><span className="eyebrow">ОТКРЫВАЙ · СОХРАНЯЙ · ПРОБУЙ</span><h1>{sectionTitles[kind]}</h1><p>{subtitles[kind]}</p></div><Search value={query} onChange={setQuery} placeholder={`Поиск: ${kind === 'events' ? 'название, событие, площадка' : kind === 'places' ? 'место, категория, адрес' : 'услуга, мастер, категория'}`}/><div className="filter-scroll" role="group" aria-label="Категории">{categories[kind].map(name => <button key={name} className={`chip ${name === category ? 'selected' : ''}`} aria-pressed={name === category} onClick={() => setCategory(name)}>{name}</button>)}</div>
 {kind === 'events' && <div className="date-filter" role="group" aria-label="Дата события">{['Все даты', 'Сегодня', 'Завтра'].map(date => <button key={date} aria-pressed={date === when} className={date === when ? 'selected' : ''} onClick={() => setWhen(date)}>{date}</button>)}</div>}
 <div className="results-caption" aria-live="polite"><span>{items.length} {kind === 'events' ? 'событий' : kind === 'places' ? 'мест' : 'услуг'}</span><span>Демо-подборка</span></div>
 {items.length ? <div className="card-grid">{items.map(item => <Card key={item.id} item={item} {...actions}/>)}</div> : <EmptyState title="Здесь пока тихо" text="Смените категорию или попробуйте другой запрос." action="Сбросить фильтры" onAction={reset}/>}
 </>;
}
