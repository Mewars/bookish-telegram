import { useState } from 'react';
import type { Item, Kind, Section, TelegramUser } from '../types';
import { Card, type CardActions } from './Card';
import { Search } from './Search';
import { EmptyState } from './EmptyState';
import { Icon, type IconName } from './Icon';
import { MediaImage } from './MediaImage';
import { cityCover } from '../data/cityCover';
import { matches } from '../utils/search';

const discoveries: { label: string; icon: IconName; matches: (item: Item) => boolean }[] = [
  { label: 'Сегодня', icon: 'events', matches: item => item.kind === 'events' && item.dateOffset === 0 },
  { label: 'Поесть', icon: 'places', matches: item => item.kind === 'places' && item.category.split(' / ')[0] === 'Кафе' },
  { label: 'Погулять', icon: 'pin', matches: item => item.kind === 'places' && ['Парки', 'Достопримечательности'].includes(item.category.split(' / ')[0]) },
  { label: 'Культура', icon: 'star', matches: item => item.kind === 'places' && item.category.split(' / ')[0] === 'Музеи' },
  { label: 'Услуги', icon: 'services', matches: item => item.kind === 'services' },
];

export function CityHome({ city, items, navigate, user, ...actions }: CardActions & { city: string; items: Item[]; user?: TelegramUser; navigate: (section: Section) => void }) {
  const [query, setQuery] = useState('');
  const [discovery, setDiscovery] = useState<string | null>(null);

  const selected = discoveries.find(option => option.label === discovery);
  const results = items.filter(item => matches(item, query) && (!selected || selected.matches(item)));
  const searching = !!query.trim() || !!selected;
  const reset = () => { setQuery(''); setDiscovery(null); };

  const selection = (title: string, subtitle: string, kind: Kind, entries: Item[], index: string, limit = 4) =>
    entries.length > 0 && <section className="city-section" data-selection={index}>
      <div className="section-heading">
        <div>
          <span className="section-index">{index} / РЯДОМ</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button className="text-action" onClick={() => navigate(kind)} aria-label={`Смотреть все: ${title}`}>
          Смотреть все <Icon name="arrow" size={18}/>
        </button>
      </div>
      <div className="card-grid discovery-grid">
        {entries.slice(0, limit).map(item => <Card key={item.id} item={item} {...actions}/>)}
      </div>
    </section>;

  const pick = (ids: string[]) => ids.flatMap(id => {
    const item = items.find(entry => entry.id === id);
    return item ? [item] : [];
  });

  const popular = pick([
    'place-spassky-monastery',
    'place-kytmanov-museum',
    'place-borodkin-house',
  ]);

  return <div className="city-home">
    <section className="city-cover" aria-labelledby="city-cover-title">
      <div className="cover-image">
        <MediaImage src={cityCover.src} alt={cityCover.alt} eager/>
      </div>
      <div className="cover-atmosphere" aria-hidden="true"/>

      <div className="city-cover-content">
        <h1 id="city-cover-title">{city}</h1>
        <p className="cover-tagline">Открывай город по-новому</p>
        <p className="cover-summary">Места, события и полезные услуги города в одном месте.</p>

        <div className="cover-search">
          <Search value={query} onChange={setQuery} placeholder="Поиск мест, событий, услуг…"/>
          <button
            className="cover-search-action"
            aria-label="Показать результаты поиска"
            onClick={() => document.getElementById('city-selections')?.scrollIntoView({ behavior: 'auto', block: 'start' })}
          >
            <Icon name="arrow" size={22}/>
          </button>
        </div>

        <div className="quick-discovery" role="group" aria-label="Быстрые сценарии">
          {discoveries.map(option => <button
            key={option.label}
            aria-pressed={discovery === option.label}
            onClick={() => setDiscovery(current => current === option.label ? null : option.label)}
          >
            <Icon name={option.icon} size={17}/>
            {option.label}
          </button>)}
        </div>

      </div>

      <span className="cover-media-credit">{cityCover.caption}</span>
    </section>

    {user?.first_name && <button className="cover-welcome" onClick={() => navigate('profile')}>
      Привет, {user.first_name} <Icon name="arrow" size={16}/>
    </button>}

    <div id="city-selections">
      {searching ? <section className="city-section">
        <div className="section-heading">
          <div>
            <span className="section-index">ТВОЯ ПОДБОРКА</span>
            <h2>{selected?.label ?? 'Нашлось рядом'}</h2>
            <p role="status">
              Найдено: {results.length}
              {selected?.label === 'Сегодня' || selected?.label === 'Услуги' ? ' · демонстрационные данные' : ''}
            </p>
          </div>
          <button className="text-action" onClick={reset}>Сбросить <Icon name="close" size={17}/></button>
        </div>
        {results.length
          ? <div className="card-grid">{results.map(item => <Card key={item.id} item={item} {...actions}/>)}</div>
          : <EmptyState title="Пока ничего" text="Попробуйте «музей», «кафе» или «фото»." action="Сбросить поиск" onAction={reset}/>}
      </section> : <>
        {selection('Популярные места', 'То, с чего удобно начать знакомство с Енисейском.', 'places', popular, '01', 3)}
        {selection('Куда сходить', 'Поводы выйти из дома · демонстрационная афиша', 'events', items.filter(item => item.kind === 'events'), '02')}
        {selection('Где поесть', 'Кофе, обед и разговоры без спешки.', 'places', items.filter(item => discoveries[1].matches(item)), '03')}
        {selection('Места, которые стоит увидеть', 'История города в деталях.', 'places', pick(['place-kytmanov-museum', 'place-borodkin-house', 'place-photoizba', 'place-spassky-monastery']), '04')}
        {selection('Услуги рядом', 'Нужные люди и полезные дела · демо-подборка', 'services', items.filter(item => item.kind === 'services'), '05')}
      </>}
    </div>
  </div>;
}
