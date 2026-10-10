import { placeMapLinks } from '../maps/placeMapLinks';
import { PlaceMap } from '../components/places/PlaceMap';
import type { Item } from '../types';
import { Icon } from '../components/Icon';
import { Card } from '../components/Card';
import { PlaceMedia } from '../components/MediaImage';
import { eventDate } from '../utils/date';
import { hoursDisclaimer, phoneHref, suppliedDate } from '../utils/place';
function externalUrl(value?: string, vk = false) {
  try {
    if (!value) return;
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
    if (vk && !['vk.com', 'vk.ru'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return;
    return url.href;
  } catch { /* Only safe supplied links become actions. */ }
}
export function DetailPage({ item, saved, toggle, goBack, favoritesBusy = false, desktop = false, relatedItems = [], favorites = [], openRelated }: { item: Item; saved: boolean; toggle: (id: string) => void; goBack: () => void; desktop?: boolean; favoritesBusy?: boolean; relatedItems?: Item[]; favorites?: string[]; openRelated?: (item: Item) => void }) {
  const realPlace = item.real && item.kind === 'places';
  const mobileMapLinks = realPlace ? placeMapLinks(item) : undefined;
  const hasFacts = item.kind === 'events' || item.address || item.hours || item.price || item.phone;
  const website = externalUrl(item.website);
  const vkUrl = externalUrl(item.vkUrl, true);
  const related = realPlace ? relatedItems.filter(entry => entry.real && entry.id !== item.id && entry.city === item.city && entry.kind === item.kind && entry.category.split(' / ')[0] === item.category.split(' / ')[0]).slice(0, 3) : [];
  return <article className={`guide-detail ${realPlace ? 'is-real-place' : ''} ${desktop ? 'detail-desktop' : ''}`}>
    <div className="detail-breadcrumb"><button className="back-link" onClick={goBack}><Icon name="back" size={18}/> Назад к подборке</button><span>{item.city} / {item.category}</span></div>
    <div className="detail-cover"><PlaceMedia images={[{ src: item.image, alt: `Изображение: ${item.title}` }]}/><div className="detail-heading"><span className="eyebrow">{item.city} · {item.category}{!item.real ? ' · ДЕМО' : ''}</span><h1>{item.title}</h1>{!item.real && item.rating && <span className="detail-rating"><Icon name="star" size={14} filled/>{item.rating} · демонстрационная оценка</span>}</div>
      {item.image.split(/[?#]/)[0].endsWith('.svg') && <p className="illustration-caption">Стилизованная иллюстрация, не фотография {realPlace ? 'места' : 'события или услуги'}</p>}
    </div>
    <div className="detail-mobile-actions">{mobileMapLinks?.routeUrl && <a className="secondary-button" href={mobileMapLinks.routeUrl} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={17}/>Маршрут</a>}{mobileMapLinks?.mapsUrl && <a className="secondary-button" href={mobileMapLinks.mapsUrl} target="_blank" rel="noopener noreferrer">Открыть карту</a>}{item.phone && <a className="secondary-button" href={phoneHref(item.phone)}><Icon name="phone" size={17}/>Позвонить</a>}<button className="secondary-button" disabled={favoritesBusy} aria-pressed={saved} onClick={() => toggle(item.id)}><Icon name="heart" size={18} filled={saved}/>{saved ? 'Сохранено' : 'В избранное'}</button><button className="secondary-button" onClick={() => document.getElementById('detail-contacts')?.scrollIntoView({ behavior: 'auto', block: 'start' })}><Icon name="pin" size={17}/>Контакты и маршрут</button></div>
    <div className="guide-detail-grid"><div className="guide-detail-copy">
      {item.details && <p className="detail-intro">{item.description}</p>}
      <section className="detail-description"><h2>{item.kind === 'events' ? 'Что тебя ждёт' : item.kind === 'places' ? 'О месте' : 'Об услуге'}</h2><p>{item.details ?? item.description}</p></section>
      {item.real ? <div className="place-source">{item.sourceType === 'user_provided' && <span>Данные предоставлены пользователем{item.verifiedAt ? ` · ${suppliedDate(item.verifiedAt)}` : ''}. Независимая проверка не проводилась.</span>}</div> : <div className="demo-note">Демонстрационная карточка. Все названия, адреса и оценки вымышлены. {item.kind === 'events' ? 'Билеты не продаются.' : 'Контакты и онлайн-запись недоступны.'}</div>}
    </div><aside id="detail-contacts" className="guide-detail-sidebar" aria-label="Контакты и действия">
      {hasFacts && <div className="detail-facts">
        {item.kind === 'events' && <div><Icon name="events" size={18}/><span><small>Когда</small><strong>{eventDate(item.dateOffset, true)} · {item.time}</strong></span></div>}
        {item.address && <div><Icon name="pin" size={18}/><span><small>{item.kind === 'services' ? 'Где работает' : 'Адрес'}</small><strong>{item.address}</strong></span></div>}
        {item.hours && <div><Icon name="clock" size={18}/><span><small>Часы работы</small><strong>{item.hours}{!item.real && ' · дни указаны ниже'}</strong>{item.real && <small className="hours-disclaimer">{hoursDisclaimer}</small>}</span></div>}
        {item.phone && <div><Icon name="phone" size={18}/><span><small>Телефон</small><a className="phone-link" href={phoneHref(item.phone)}>{item.phone}</a></span></div>}
        {item.price && <div><Icon name="services" size={18}/><span><small>{item.kind === 'places' ? 'Стоимость' : item.kind === 'events' ? 'Вход' : 'Ориентировочная цена'}</small><strong>{item.price}</strong></span></div>}
      </div>}
      {realPlace && <PlaceMap key={item.id} item={item} desktop={desktop}/>}
      <div className="detail-actions">{item.phone && <a className="secondary-button" href={phoneHref(item.phone)}><Icon name="phone" size={17}/>Позвонить</a>}{website && <a className="secondary-button" href={website} target="_blank" rel="noopener noreferrer">Сайт <Icon name="arrow" size={17}/></a>}{vkUrl && <a className="secondary-button" href={vkUrl} target="_blank" rel="noopener noreferrer">VK <Icon name="arrow" size={17}/></a>}
        <button className={`secondary-button detail-save ${saved ? 'is-saved' : ''}`} disabled={favoritesBusy} aria-pressed={saved} onClick={() => toggle(item.id)}><Icon name="heart" size={18} filled={saved}/>{saved ? 'Сохранено · убрать' : 'В избранное'}</button>
      </div>
    </aside></div>
    {!!related.length && openRelated && <section className="city-section related-section"><div className="section-heading"><div><span className="section-index">ПРОДОЛЖАЙ ОТКРЫВАТЬ</span><h2>Ещё рядом</h2><p>{item.city} · {item.category.split(' / ')[0]}</p></div></div><div className="card-grid discovery-grid">{related.map(entry => <Card key={entry.id} item={entry} favorites={favorites} toggle={toggle} favoritesBusy={favoritesBusy} open={openRelated}/>)}</div></section>}
  </article>;
}
