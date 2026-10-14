import { useState } from 'react';
import type { Item, Kind, Section } from '../types';
import { Card, type CardActions } from './Card';
import { Search } from './Search';
import { EmptyState } from './EmptyState';
import { Icon, type IconName } from './Icon';
import { MediaImage } from './MediaImage';
import { getCityCover } from '../data/cityCover';
import type { DirectoryCity } from '../data/cities';
import { matches } from '../utils/search';

const discoveries: { label: string; icon: IconName; matches: (item: Item) => boolean }[] = [
  { label: 'Сегодня', icon: 'events', matches: item => item.kind === 'events' && item.dateOffset === 0 },
  { label: 'Поесть', icon: 'places', matches: item => item.kind === 'places' && item.category.split(' / ')[0] === 'Кафе' },
  { label: 'Погулять', icon: 'pin', matches: item => item.kind === 'places' && ['Парки', 'Достопримечательности'].includes(item.category.split(' / ')[0]) },
  { label: 'Культура', icon: 'star', matches: item => item.kind === 'places' && ['Музеи', 'Культура', 'Библиотеки'].includes(item.category.split(' / ')[0]) },
  { label: 'Услуги', icon: 'services', matches: item => item.kind === 'services' },
];

export function CityHome({ city, cityProfile, items, navigate, ...actions }: CardActions & { city: string; cityProfile?: DirectoryCity; items: Item[]; navigate: (section: Section) => void }) {
  const [query, setQuery] = useState('');
  const cover = getCityCover(city, cityProfile?.cover_url);
  const isEniseysk = city === 'Енисейск';
  const [discovery, setDiscovery] = useState<string | null>(null);

  const selected = discoveries.find(option => option.label === discovery);
  const results = items.filter(item => matches(item, query) && (!selected || selected.matches(item)));
  const searching = !!query.trim() || !!selected;
  const reset = () => { setQuery(''); setDiscovery(null); };
  const showResults = () => {
    window.requestAnimationFrame(() => {
      document.getElementById('city-selections')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  };
  const chooseDiscovery = (label: string) => {
    // A shortcut is a direct destination, not another filter applied to a prior search.
    setQuery('');
    setDiscovery(label);
    showResults();
  };

  const selection = (title: string, subtitle: string, kind: Kind, entries: Item[], index: string, limit = 4) =>
    <section className="city-section" data-selection={index}>
      <div className="section-heading">
        <div>
          <span className="section-index">{index} / РЯДОМ</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button className="text-action" onClick={() => navigate(kind)} aria-label={index === '01' ? 'Посмотреть все места' : `Смотреть все: ${title}`}>
          {index === '01' ? 'Посмотреть все места' : 'Смотреть все'} <Icon name="arrow" size={18}/>
        </button>
      </div>
      {entries.length > 0
        ? <div className="card-grid discovery-grid">
            {entries.slice(0, limit).map(item => <Card key={item.id} item={item} featured={index === '01'} {...actions}/>)}
          </div>
        : <p className="city-section-coming-soon">Пока нет подтверждённых {kind === 'events' ? 'событий' : kind === 'services' ? 'услуг' : 'мест'}. Раздел будем наполнять реальными карточками.</p>}
    </section>;

  const pick = (ids: string[]) => ids.flatMap(id => {
    const item = items.find(entry => entry.id === id);
    return item ? [item] : [];
  });

  const popular = isEniseysk ? pick([
    'place-spassky-monastery',
    'place-kytmanov-museum',
    'place-borodkin-house',
  ]) : items.filter(item => item.kind === 'places').slice(0,3);
  const highlights = isEniseysk ? pick(['place-kytmanov-museum', 'place-borodkin-house', 'place-photoizba', 'place-spassky-monastery']) : items.filter(item => item.kind === 'places' && ['Музеи','Достопримечательности','Культура','Парки'].includes(item.category.split(' / ')[0])).slice(0,4);

  return <div className="city-home">
    <section className={`city-cover${cover ? "" : " city-cover--no-image"}${city.length > 9 ? " city-cover--long-name" : ""}`} aria-labelledby="city-cover-title">
      {cover ? <div className="cover-image"><MediaImage src={cover.src} alt={cover.alt} eager/></div> : <div className="cover-image cover-image--neutral" aria-hidden="true"/>}
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
            onClick={showResults}
          >
            <Icon name="arrow" size={22}/>
          </button>
        </div>

        <div className="quick-discovery" role="group" aria-label="Быстрые сценарии">
          {discoveries.map(option => <button
            key={option.label}
            aria-pressed={discovery === option.label}
            onClick={() => chooseDiscovery(option.label)}
          >
            <Icon name={option.icon} size={17}/>
            {option.label}
          </button>)}
        </div>

      </div>

    </section>



    <div id="city-selections">
      {searching ? <section className="city-section">
        <div className="section-heading">
          <div>
            <span className="section-index">ТВОЯ ПОДБОРКА</span>
            <h2>{selected?.label ?? 'Нашлось рядом'}</h2>
            <p role="status">
              Найдено: {results.length}
            </p>
          </div>
          <button className="text-action" onClick={reset}>Сбросить <Icon name="close" size={17}/></button>
        </div>
        {results.length
          ? <div className="card-grid">{results.map(item => <Card key={item.id} item={item} {...actions}/>)}</div>
          : <EmptyState
              title={selected ? 'Пока нет записей' : 'Ничего не найдено'}
              text={selected ? `В разделе «${selected.label}» пока нет подтверждённых записей. Добавим их после проверки информации.` : 'Попробуйте «музей», «кафе» или «парк».'}
              action="Посмотреть все места"
              onAction={reset}
            />}
      </section> : <>
        {selection('Популярные места', 'То, с чего удобно начать знакомство с городом.', 'places', popular, '01', 3)}
        {selection('Куда сходить', 'Поводы выйти из дома.', 'events', items.filter(item => item.kind === 'events'), '02')}
        {selection('Где поесть', 'Кофе, обед и разговоры без спешки.', 'places', items.filter(item => discoveries[1].matches(item)), '03')}
        {selection('Места, которые стоит увидеть', 'История города в деталях.', 'places', highlights, '04')}
        {selection('Услуги рядом', 'Нужные люди и полезные дела.', 'services', items.filter(item => item.kind === 'services'), '05')}
      </>}
    </div>
  </div>;
}
