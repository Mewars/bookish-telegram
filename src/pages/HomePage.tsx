import { useState } from 'react';
import type { Section, TelegramUser } from '../types';
import { catalog } from '../data/catalog';
import { Card, type CardActions } from '../components/Card';
import { Search } from '../components/Search';
import { Icon, type IconName } from '../components/Icon';
import { EmptyState } from '../components/EmptyState';
import { matches } from '../utils/search';
import city from '../assets/city.svg';
const shortcuts: { label: string; icon: IconName; section: Section; color: string }[] = [ { label: 'Куда сходить', icon: 'events', section: 'events', color: 'peach' }, { label: 'Где поесть', icon: 'places', section: 'places', color: 'green' }, { label: 'Найти мастера', icon: 'services', section: 'services', color: 'lavender' }, { label: 'Избранное', icon: 'heart', section: 'favorites', color: 'yellow' } ];
export function HomePage({ user, navigate, ...actions }: CardActions & { user?: TelegramUser; navigate: (section: Section) => void }) {
 const [query, setQuery] = useState('');
 const results = catalog.filter(item => matches(item, query));
 const section = (title: string, subtitle: string, target: Section, ids: string[], compact = false) => <section className="home-section"><div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button onClick={() => navigate(target)} aria-label={`Все: ${title}`}>Все <Icon name="arrow" size={17}/></button></div><div className={compact ? 'horizontal-cards' : 'card-grid'}>{ids.map(id => { const item = catalog.find(x => x.id === id)!; return <Card key={id} item={item} {...actions} compact={compact}/>; })}</div></section>;
 return <>
  <div className="greeting"><div><span className="eyebrow">МАЛЕНЬКИЙ ГОРОД · БОЛЬШИЕ ПЛАНЫ</span><h1>Привет{user?.first_name ? `, ${user.first_name}` : ''}<span className="wave"> ✳</span></h1><p>Хороший день начинается рядом.</p></div><button className="avatar small-avatar" onClick={() => navigate('profile')} aria-label="Открыть профиль"><Icon name="profile" size={25}/>{user?.photo_url && <img src={user.photo_url} alt="" referrerPolicy="no-referrer" onError={e => { e.currentTarget.hidden = true; }}/>}</button></div>
  <Search value={query} onChange={setQuery}/>
  {query.trim() ? <section className="home-section"><div className="section-heading"><h2>Нашлось: {results.length}</h2></div>{results.length ? <div className="card-grid">{results.map(item => <Card key={item.id} item={item} {...actions}/>)}</div> : <EmptyState title="Пока ничего" text="Попробуйте «кофе», «кино» или «фото»." action="Сбросить поиск" onAction={() => setQuery('')}/>}</section> : <>
   <div className="shortcuts">{shortcuts.map(item => <button key={item.label} onClick={() => navigate(item.section)}><span className={item.color}><Icon name={item.icon} size={25}/></span>{item.label}</button>)}</div>
   <section className="hero"><div className="hero-content"><span className="hero-tag"><span/>ТВОЙ ГОРОД ЖИВЁТ</span><h2>Ближе, чем<br/>кажется.</h2><p>Новые места, знакомые лица<br/>и планы на хороший вечер.</p><button onClick={() => navigate('events')}>Найти свои планы <Icon name="arrow" size={18}/></button></div><img src={city} alt="Иллюстрация уютного города"/><span className="hero-sticker">всё рядом <Icon name="arrow" size={12}/></span></section>
   {section('Сегодня в городе', 'Не откладывай хорошее на потом', 'events', ['e1', 'e2'])}
   <div className="editorial-note"><span className="note-mark"><Icon name="arrow" size={30}/></span><div><strong>Меньше скролла. Больше города.</strong><p>Открой место, мимо которого проходишь каждый день.</p></div></div>
   {section('Места с настроением', 'Те самые, куда хочется вернуться', 'places', ['p1', 'p2', 'p5'], true)}
   {section('Свои люди, нужное дело', 'Локальные услуги без долгих поисков', 'services', ['s1', 's2'], true)}
   {section('Планы на ближайшие дни', 'Добавь в избранное, чтобы не забыть', 'events', ['e3', 'e5'], true)}
  </>}
 </>;
}
