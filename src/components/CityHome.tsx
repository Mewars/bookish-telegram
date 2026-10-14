import { useState } from 'react';
import type { Item, Section } from '../types';
import { Card, type CardActions } from './Card';
import { HomeCarousel } from './HomeCarousel';
import { editorialPicks, isCulturalPlace, isFoodVenue, isService, isShop, isTodayRecommendation, weekdayInCity } from './homeDiscovery';
import { Search } from './Search';
import { EmptyState } from './EmptyState';
import { Icon, type IconName } from './Icon';
import { MediaImage } from './MediaImage';
import { getCityCover } from '../data/cityCover';
import type { DirectoryCity } from '../data/cities';
import { matches } from '../utils/search';

// Homepage background fade can be reverted independently of the content redesign
// by setting VITE_HOME_BACKDROP_ENABLED=false on the next deployment.
const homeBackdropEnabled = import.meta.env.VITE_HOME_BACKDROP_ENABLED !== 'false';

function homeShortcuts(today: number): { label: string; icon: IconName; matches: (item: Item) => boolean }[] {
  return [
    { label: 'Сегодня', icon: 'events', matches: item => isTodayRecommendation(item, today) },
    { label: 'Поесть', icon: 'places', matches: isFoodVenue },
    { label: 'Культура', icon: 'star', matches: isCulturalPlace },
    { label: 'Магазины', icon: 'shop', matches: isShop },
    { label: 'Услуги', icon: 'services', matches: isService },
  ];
}

export function CityHome({ city, cityProfile, items, navigate, ...actions }: CardActions & { city: string; cityProfile?: DirectoryCity; items: Item[]; navigate: (section: Section) => void }) {
  const [query, setQuery] = useState('');
  const cover = getCityCover(city, cityProfile?.cover_url);
  const discoveries = homeShortcuts(weekdayInCity(new Date()));
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

  const popular = editorialPicks(items, city);
  const culture = items.filter(isCulturalPlace);
  const food = items.filter(isFoodVenue);
  const shops = items.filter(isShop);
  const services = items.filter(isService);
  const events = items.filter(item => item.kind === 'events');

  return <div className="city-home">
    <section className={`city-cover${cover ? "" : " city-cover--no-image"}${city.length > 9 ? " city-cover--long-name" : ""}`} aria-labelledby="city-cover-title">
      {cover ? <div className="cover-image"><MediaImage src={cover.src} alt={cover.alt} eager/></div> : <div className="cover-image cover-image--neutral" aria-hidden="true"/>}
      <div className="cover-atmosphere" aria-hidden="true"/>

      <div className="city-cover-content">
        <h1 id="city-cover-title">{city}</h1>
        <p className="cover-tagline">{cityProfile?.tagline || "Открывай город по-новому"}</p>
        <p className="cover-summary">{cityProfile?.summary || "Места, события и полезные услуги города в одном месте."}</p>

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
      {homeBackdropEnabled && cover && <div className="city-selections-backdrop" aria-hidden="true"><MediaImage src={cover.src} alt=""/></div>}
      {searching ? <section className="city-section">
        <div className="section-heading">
          <div>
            <span className="section-index">ТВОЯ ПОДБОРКА</span>
            <h2>{selected?.label ?? 'Нашлось рядом'}</h2>
            <p role="status">
              Найдено: {results.length}
            </p>
            {selected?.label === 'Сегодня' && <p className="today-schedule-note">Места показаны по заявленному расписанию, а не по данным о работе в реальном времени. Перед посещением уточняйте часы.</p>}
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
        <HomeCarousel title="Выбор «Рядом»" subtitle="Интересные места, которые мы отобрали для знакомства с городом."
          kind="places" index="01" items={popular} navigate={navigate} featured {...actions}/>
        <HomeCarousel title="Афиша города" subtitle="Кино, выставки и события: только реальные даты и проверенная информация."
          kind="events" index="02" items={events} navigate={navigate} {...actions}/>
        <HomeCarousel title="Где поесть" subtitle="Кафе, рестораны, пиццерии и другая готовая еда."
          kind="places" index="03" items={food} navigate={navigate} {...actions}/>
        <HomeCarousel title="Что посмотреть" subtitle="Музеи, храмы, исторические здания и памятники."
          kind="places" index="04" items={culture} navigate={navigate} {...actions}/>
        <HomeCarousel title="За покупками" subtitle="Продуктовые магазины, супермаркеты и местные товары."
          kind="places" index="05" items={shops} navigate={navigate} {...actions}/>
        <HomeCarousel title="Услуги" subtitle="Ремонт, государственные сервисы, банки и полезные организации."
          kind="services" index="06" items={services} navigate={navigate} {...actions}/>
        <section className="city-section city-partners" aria-labelledby="city-partners-title">
          <div className="section-heading">
            <div><span className="section-index">07 / РЯДОМ</span>
              <h2 id="city-partners-title">Партнёры «Рядом»</h2>
              <p>Местные компании и их предложения с пометкой «Реклама».</p>
            </div>
          </div>
          <div className="city-partners-empty">
            <div><strong>Здесь появятся предложения партнёров</strong>
              <p>Размещения будем добавлять после согласования с организациями. Реклама не подменяет редакционные рекомендации.</p>
            </div>
            <button className="city-partners-contact" type="button" onClick={() => navigate('contacts')}>Для сотрудничества <Icon name="arrow" size={17}/></button>
          </div>
        </section>
      </>}
    </div>
  </div>;
}
