import { useState } from 'react';
import type { Item, Kind, Section } from '../types';
import { Card, type CardActions } from '../components/Card';
import { Search } from '../components/Search';
import { EmptyState } from '../components/EmptyState';
import { Icon, type IconName } from '../components/Icon';
import { TelegramLink } from '../components/web/TelegramLink';
import { matches } from '../utils/search';
import cityIllustration from '../assets/city.svg';

const shortcuts: { title: string; subtitle: string; icon: IconName; section: Section; color: string }[] = [
  { title: 'Куда сходить', subtitle: 'Планы на свободный вечер', icon: 'events', section: 'events', color: 'accent-tile' },
  { title: 'Где поесть', subtitle: 'Кафе своего города', icon: 'places', section: 'places', color: 'accent-tile' },
  { title: 'Найти мастера', subtitle: 'Нужные услуги поблизости', icon: 'services', section: 'services', color: 'accent-tile' },
  { title: 'Избранное', subtitle: 'Сохранённые находки', icon: 'heart', section: 'favorites', color: 'accent-tile' },
];

export function WebHomePage({ city, items, navigate, ...actions }: CardActions & { city: string; items: Item[]; navigate: (section: Section) => void }) {
  const [query, setQuery] = useState('');
  const results = items.filter(item => matches(item, query));
  const selection = (title: string, subtitle: string, kind: Kind, ids: string[]) => {
    const entries = ids.flatMap(id => { const item = items.find(entry => entry.id === id && entry.kind === kind); return item ? [item] : []; });
    return <section className="web-section"><div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button onClick={() => navigate(kind)} aria-label={`Смотреть все: ${title}`}>Смотреть все <Icon name="arrow" size={18}/></button></div><div className="card-grid">{entries.map(item => <Card key={item.id} item={item} {...actions}/>)}</div></section>;
  };
  return <div className="web-home">
    <section className="web-hero">
      <div className="web-hero-content"><span className="eyebrow">{city.toLocaleUpperCase('ru-RU')} · КРАСНОЯРСКИЙ КРАЙ</span><h1>{city}</h1><p>Места, события и полезные услуги<br/>города в одном месте</p><div className="web-hero-actions"><button className="primary-button" onClick={() => navigate('places')}>Смотреть места <Icon name="arrow" size={18}/></button><TelegramLink className="telegram-link-outline"/></div></div>
      <div className="web-hero-visual"><img src={cityIllustration} alt="Стилизованная иллюстрация города"/><span className="web-hero-sticker">всё хорошее рядом <Icon name="arrow" size={18}/></span></div>
    </section>
    <section className="web-home-search" aria-label="Поиск по городу"><div><h2>Что найдём сегодня?</h2><p>Место, событие или своего мастера</p></div><Search value={query} onChange={setQuery}/></section>
    {query.trim() ? <section className="web-section"><div className="section-heading"><h2 aria-live="polite">Результаты поиска: {results.length}</h2><button onClick={() => setQuery('')}>Сбросить поиск <Icon name="close" size={17}/></button></div>{results.length ? <div className="card-grid">{results.map(item => <Card key={item.id} item={item} {...actions}/>)}</div> : <EmptyState title="Пока ничего" text="Попробуйте «музей», «кафе» или «фото»." action="Сбросить поиск" onAction={() => setQuery('')}/>}</section> : <>
      <div className="web-shortcuts">{shortcuts.map(shortcut => <button key={shortcut.title} onClick={() => navigate(shortcut.section)}><span className={shortcut.color}><Icon name={shortcut.icon} size={25}/></span><span><strong>{shortcut.title}</strong><small>{shortcut.subtitle}</small></span><Icon name="arrow" size={18}/></button>)}</div>
      {selection('Куда сходить в Енисейске', 'История, прогулки и знакомые места с нового ракурса', 'places', ['place-kytmanov-museum', 'place-monastery-park', 'place-don-leon'])}
      {selection('Афиша', 'Поводы выйти из дома · демонстрационная подборка', 'events', ['e1', 'e2', 'e3'])}
      {selection('Услуги рядом', 'Нужные люди и полезные дела · демонстрационная подборка', 'services', ['s1', 's2', 's4'])}
    </>}
    <section className="web-telegram-cta"><div><span className="eyebrow">ТВОЙ ГОРОД — В ТВОЁМ ТЕЛЕФОНЕ</span><h2>Рядом всегда под рукой</h2><p>Открой приложение в Telegram и сохрани свои находки.</p></div><TelegramLink/></section>
  </div>;
}
