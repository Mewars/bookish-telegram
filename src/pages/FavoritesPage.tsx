import { useState } from 'react';
import { sectionTitles } from '../data/catalog';
import { Card, type CardActions } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import type { Item, Kind } from '../types';
export function FavoritesPage({ goBack, explore, items: cityItems, ...actions }: CardActions & { goBack: () => void; explore: () => void; items: Item[] }) {
 const [filter, setFilter] = useState<Kind | 'all'>('all');
 const items = cityItems.filter(item => actions.favorites.includes(item.id) && (filter === 'all' || item.kind === filter));
 return <><button className="back-link" onClick={goBack}><Icon name="back" size={18}/> Назад</button><div className="page-heading"><span className="eyebrow">ТВОЯ ЛИЧНАЯ ПОДБОРКА</span><h1>Избранное <span className="title-count">{cityItems.filter(item => actions.favorites.includes(item.id)).length}</span></h1><p>Хорошие находки всегда под рукой.</p></div><div className="filter-scroll" role="group" aria-label="Тип избранного">{(['all', 'events', 'places', 'services'] as const).map(kind => <button key={kind} className={`chip ${filter === kind ? 'selected' : ''}`} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind === 'all' ? 'Всё' : sectionTitles[kind]}</button>)}</div>{items.length ? <div className="card-grid">{items.map(item => <Card key={item.id} item={item} {...actions}/>)}</div> : <EmptyState title={filter === 'all' ? 'Сохрани что-то хорошее' : 'В этой подборке пока пусто'} text="Нажмите на сердечко у события, места или услуги — находка останется здесь." action="Посмотреть афишу" onAction={explore}/>}</>;
}
