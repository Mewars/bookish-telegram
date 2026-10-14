import type { Item } from '../types';
import { placeMapLinks } from '../maps/placeMapLinks';
import { PlaceMap } from '../components/places/PlaceMap';
import { Icon } from '../components/Icon';
import { Card } from '../components/Card';
import { PlaceMedia } from '../components/MediaImage';
import { eventDate } from '../utils/date';
import { hoursDisclaimer, phoneHref, suppliedDate } from '../utils/place';

function externalUrl(value?: string, vk = false) {
  try {
    if (!value) return;
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return;
    if (vk && !['vk.com', 'vk.ru'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return;
    return url.href;
  } catch { /* Unsafe links must never become actions. */ }
}

function publicDetails(text: string) {
  return text
    .replace('Это демонстрационная карточка, билеты не продаются.', 'Билеты не продаются.')
    .replace('Демонстрационный исполнитель: контакты и запись появятся после подключения сервиса.', 'Контакты и запись появятся после подключения сервиса.')
    .replace(' Демонстрационная услуга.', '')
    .replace('Заказы в демо не принимаются.', 'Заказы пока не принимаются.')
    .replace('Это демонстрационная карточка, реальный заказ недоступен.', 'Заказ недоступен.');
}

interface DetailPageProps {
  item: Item;
  saved: boolean;
  toggle: (id: string) => void;
  goBack: () => void;
  desktop?: boolean;
  favoritesBusy?: boolean;
  relatedItems?: Item[];
  favorites?: string[];
  openRelated?: (item: Item) => void;
}

export function DetailPage({
  item, saved, toggle, goBack, favoritesBusy = false, desktop = false,
  relatedItems = [], favorites = [], openRelated,
}: DetailPageProps) {
  const maps = placeMapLinks(item);
  const website = externalUrl(item.website);
  const vkUrl = externalUrl(item.vkUrl, true);
  const sourceUrl = externalUrl(item.sourceUrl);
  const realPlace = item.real && item.kind === 'places';
  const related = realPlace
    ? relatedItems.filter(entry => entry.real && entry.id !== item.id && entry.city === item.city
      && entry.kind === item.kind && entry.category.split(' / ')[0] === item.category.split(' / ')[0]).slice(0, 3)
    : [];
  const title = item.kind === 'events' ? 'О событии' : item.kind === 'services' ? 'Об услуге' : 'О месте';
  const hasMap = Boolean(item.coordinates);
  const mappedDesktop = desktop && hasMap && item.kind !== 'events';
  const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return <article className={mappedDesktop ? "guide-detail guide-detail--mapped" : "guide-detail"}>
    <div className="detail-breadcrumb">
      <button className="back-link" onClick={goBack}>
        <Icon name="back" size={18}/>
        {item.kind === 'events' ? 'Назад в афишу' : item.kind === 'services' ? 'Назад к услугам' : 'Назад в каталог мест'}
      </button>
      <span>{item.city} / {item.category}</span>
    </div>

    <div className="detail-place-layout"><div className="detail-place-main">
    <div className="detail-cover" id="detail-photos">
      <PlaceMedia images={[{ src: item.image, alt: `Изображение: ${item.title}` }]}/>
      <div className="detail-heading">
        <span className="eyebrow">{item.city} · {item.category}</span>
        <h1>{item.title}</h1>
      </div>
      {(item.photoIllustrative || item.image.split(/[?#]/)[0].endsWith('.svg') || item.photoCredit) && <p className="illustration-caption">{item.photoIllustrative ? 'Тематическая фотография, не снимок этой организации.' : item.image.split(/[?#]/)[0].endsWith('.svg') ? 'Иллюстрация, не фотография организации.' : 'Фото реального объекта.'} {item.photoCredit && (item.photoSourceUrl ? <a href={item.photoSourceUrl} target="_blank" rel="noopener noreferrer">{item.photoCredit}</a> : item.photoCredit)} {item.photoLicenseUrl && <a href={item.photoLicenseUrl} target="_blank" rel="noopener noreferrer">Лицензия</a>}</p>}
    </div>

    <nav className="detail-quick-tabs" aria-label="Разделы карточки">
      <button type="button" onClick={() => scrollToSection('detail-about')}>Обзор</button>
      <button type="button" onClick={() => scrollToSection('detail-photos')}>Фото</button>
      <button type="button" onClick={() => scrollToSection('detail-contacts')}>Контакты</button>
      {hasMap && <button type="button" onClick={() => scrollToSection('detail-map')}>Карта</button>}
      {maps.routeUrl && <a href={maps.routeUrl} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={15}/> Маршрут в Яндекс Картах</a>}
    </nav>
    <div className="detail-content-grid">
      <section className="detail-info-tile" id="detail-about" aria-labelledby="detail-about-heading">
        <span className="detail-tile-kicker"><Icon name="places" size={16}/> ИНФОРМАЦИЯ</span>
        <h2 id="detail-about-heading">{title}</h2>
        <p>{publicDetails(item.details ?? item.description)}</p>
        {item.real && <div className="place-source">
          {item.sourceType === 'user_provided'
            ? <span>Данные предоставлены пользователем. Независимая проверка не проводилась.</span>
            : <span>Сведения собраны из открытых источников{item.verifiedAt ? ` · ${suppliedDate(item.verifiedAt)}` : ''}. Уточняйте актуальность перед посещением.</span>}
          {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Проверить источник <Icon name="arrow" size={13}/></a>}
        </div>}
        {!item.real && <p className="detail-demo-notice">Бронирование и оплата через сервис пока не доступны.</p>}
      </section>

      <section className="detail-contact-tiles" id="detail-contacts" aria-label="Адрес, контакты и полезная информация">
        {item.kind === 'events' && <div className="detail-contact-tile">
          <span className="detail-contact-icon"><Icon name="events" size={20}/></span>
          <span className="detail-contact-label">Когда</span>
          <strong>{eventDate(item.dateOffset, true)}{item.time ? ` · ${item.time}` : ''}</strong>
        </div>}
        {item.address && (maps.mapsUrl
          ? <a className="detail-contact-tile detail-contact-tile--link" href={maps.mapsUrl} target="_blank" rel="noopener noreferrer">
              <span className="detail-contact-icon"><Icon name="pin" size={20}/></span>
              <span className="detail-contact-label">Адрес · открыть на карте</span>
              <strong>{item.city}, {item.address}</strong>
              <span className="detail-contact-action">Открыть на карте <Icon name="arrow" size={15}/></span>
            </a>
          : <div className="detail-contact-tile">
              <span className="detail-contact-icon"><Icon name="pin" size={20}/></span>
              <span className="detail-contact-label">Адрес</span><strong>{item.city}, {item.address}</strong>
            </div>)}
        {item.phone && <a className="detail-contact-tile detail-contact-tile--link" href={phoneHref(item.phone)}>
          <span className="detail-contact-icon"><Icon name="phone" size={20}/></span>
          <span className="detail-contact-label">Телефон · позвонить</span>
          <strong>{item.phone}</strong><span className="detail-contact-action">Позвонить <Icon name="arrow" size={15}/></span>
        </a>}
        {item.hours && <div className="detail-contact-tile">
          <span className="detail-contact-icon"><Icon name="clock" size={20}/></span>
          <span className="detail-contact-label">Режим работы</span>
          <strong>{item.hours}</strong>
          {item.real && <small>{hoursDisclaimer}</small>}
        </div>}
        {item.price && <div className="detail-contact-tile">
          <span className="detail-contact-icon"><Icon name="services" size={20}/></span>
          <span className="detail-contact-label">Стоимость</span><strong>{item.price}</strong>
        </div>}
        {website && <a className="detail-contact-tile detail-contact-tile--link" href={website} target="_blank" rel="noopener noreferrer">
          <span className="detail-contact-icon"><Icon name="arrow" size={20}/></span>
          <span className="detail-contact-label">Официальный сайт</span>
          <strong>Перейти на сайт</strong>
          <span className="detail-contact-action">Открыть <Icon name="arrow" size={15}/></span>
        </a>}
        {vkUrl && <a className="detail-contact-tile detail-contact-tile--link" href={vkUrl} target="_blank" rel="noopener noreferrer">
          <span className="detail-contact-icon"><Icon name="profile" size={20}/></span>
          <span className="detail-contact-label">ВКонтакте</span>
          <strong>Страница организации</strong>
          <span className="detail-contact-action">Открыть <Icon name="arrow" size={15}/></span>
        </a>}
        <button type="button" className="detail-contact-tile detail-contact-tile--link detail-contact-save"
          disabled={favoritesBusy} aria-pressed={saved} onClick={() => toggle(item.id)}>
          <span className="detail-contact-icon"><Icon name="heart" size={20} filled={saved}/></span>
          <span className="detail-contact-label">Избранное</span>
          <strong>{saved ? 'Сохранено' : 'Сохранить место'}</strong>
          <span className="detail-contact-action">{saved ? 'Убрать из избранного' : 'Добавить в избранное'} <Icon name="arrow" size={15}/></span>
        </button>
      </section>
    </div>

    </div>
    {hasMap && <aside className="detail-map-rail" id="detail-map" aria-label="Местоположение организации">
      <div className="detail-map-tile"><PlaceMap key={item.id} item={item} desktop={desktop}/></div>
    </aside>}
    </div>
    {!!related.length && openRelated && <section className="city-section related-section">
      <div className="section-heading"><div><span className="section-index">ПРОДОЛЖАЙ ОТКРЫВАТЬ</span><h2>Ещё рядом</h2><p>{item.city} · {item.category.split(' / ')[0]}</p></div></div>
      <div className="card-grid discovery-grid">{related.map(entry => <Card key={entry.id} item={entry} favorites={favorites} toggle={toggle} favoritesBusy={favoritesBusy} open={openRelated}/>)}</div>
    </section>}
  </article>;
}
