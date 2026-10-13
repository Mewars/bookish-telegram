import { useState } from 'react';
import type { Item, Kind } from '../types';
import { categories, sectionTitles } from '../data/catalog';
import { Card, type CardActions } from '../components/Card';
import { Search } from '../components/Search';
import { EmptyState } from '../components/EmptyState';
import { matches } from '../utils/search';
const subtitles: Record<Kind, string> = { events: 'Настоящие события Енисейска скоро появятся здесь.', places: 'Кафе, музеи, гостиницы, культура и интересные места Енисейска.', services: 'Полезные городские организации и услуги Енисейска.' };
export function CatalogPage({ kind, items: cityItems, addOrganization, catalogStatus, retryCatalog, ...actions }: CardActions & { kind: Kind; items: Item[]; addOrganization?: () => void; catalogStatus?: 'loading' | 'ready' | 'fallback'; retryCatalog?: () => void }) {
 const [query, setQuery] = useState(''); const [category, setCategory] = useState('Все');
 const [when, setWhen] = useState('Все даты');
 const hasPublishedItems = cityItems.some(item => item.kind === kind);
 const items = cityItems.filter(item => item.kind === kind && (category === 'Все' || item.category.split(' / ')[0] === category) && matches(item, query) && (kind !== 'events' || when === 'Все даты' || item.dateOffset === (when === 'Сегодня' ? 0 : 1)));
 const availableCategories = hasPublishedItems ? [...new Set([...categories[kind], ...cityItems.filter(item => item.kind === kind).map(item => item.category.split(' / ')[0])])] : ['Все'];
 const reset = () => { setQuery(''); setCategory('Все'); setWhen('Все даты'); };
 return <><div className="page-heading"><span className="eyebrow">ОТКРЫВАЙ · СОХРАНЯЙ · ПРОБУЙ</span><h1>{sectionTitles[kind]}</h1><p>{subtitles[kind]}</p>{addOrganization && <button className="primary-button organization-catalog-action" onClick={addOrganization}>Добавить организацию</button>}</div>{kind === 'places' && catalogStatus === 'loading' && <p className="organization-catalog-status" role="status">Обновляем каталог. Местные карточки уже доступны.</p>}{kind === 'places' && catalogStatus === 'fallback' && <div className="organization-catalog-status" role="status">Сервис организаций недоступен. Показан сохранённый каталог.<button className="back-link" onClick={retryCatalog}>Повторить</button></div>}<Search value={query} onChange={setQuery} placeholder={`Поиск: ${kind === 'events' ? 'название, событие, площадка' : kind === 'places' ? 'место, категория, адрес' : 'услуга, мастер, категория'}`}/><div className="filter-scroll" role="group" aria-label="Категории">{availableCategories.map(name => <button key={name} className={`chip ${name === category ? 'selected' : ''}`} aria-pressed={name === category} onClick={() => setCategory(name)}>{name}</button>)}</div>
 {kind === 'events' && hasPublishedItems && <div className="date-filter" role="group" aria-label="Дата события">{['Все даты', 'Сегодня', 'Завтра'].map(date => <button key={date} aria-pressed={date === when} className={date === when ? 'selected' : ''} onClick={() => setWhen(date)}>{date}</button>)}</div>}
 <div className="results-caption" aria-live="polite"><span>{items.length} {kind === 'events' ? 'событий' : kind === 'places' ? 'мест' : 'услуг'}</span><span>{kind === 'places' ? 'Места Енисейска' : kind === 'events' ? 'События Енисейска' : 'Услуги Енисейска'}</span></div>
 {items.length ? <div className="card-grid">{items.map(item => <Card key={item.id} item={item} {...actions}/>)}</div> : !hasPublishedItems ? <EmptyState title={kind === 'events' ? 'Афиша пока пуста' : kind === 'services' ? 'Услуги скоро появятся' : 'Места скоро появятся'} text={kind === 'events' ? 'Добавим сюда только подтверждённые события Енисейска.' : kind === 'services' ? 'Добавим сюда только реальные услуги и исполнителей.' : 'Проверяем сведения о местах перед публикацией.'}/> : <EmptyState title="Здесь пока тихо" text="Смените категорию или попробуйте другой запрос." action="Сбросить фильтры" onAction={reset}/>} 
 </>;
}
