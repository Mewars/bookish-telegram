import { PlaceMap } from '../components/places/PlaceMap';
import type { Item } from '../types';
import { Icon } from '../components/Icon';
import { eventDate } from '../utils/date';
import { hoursDisclaimer, phoneHref, suppliedDate } from '../utils/place';

export function DetailPage({ item, saved, toggle, goBack, favoritesBusy = false, desktop = false }: { item: Item; saved: boolean; toggle: (id: string) => void; goBack: () => void; desktop?: boolean; favoritesBusy?: boolean }) {
 const hasFacts = item.kind === 'events' || item.address || item.hours || item.price || item.phone;
 const visual = <>
  <div className="detail-image"><img src={item.image} alt={`Иллюстрация: ${item.title}`}/><span className="image-label">{item.category}</span></div>
  {item.real && <p className="illustration-caption">Стилизованная иллюстрация, не фотография места</p>}
 </>;
 const content = <>
  <div className="detail-heading"><div><span className="eyebrow">{item.kind === 'events' ? 'ЕСТЬ ПЛАН НА ВЕЧЕР' : item.kind === 'places' ? desktop ? item.category : 'МЕСТО ДЛЯ ТЕБЯ' : item.provider}</span><h1>{item.title}</h1></div>{!item.real && item.rating && <span className="detail-rating"><Icon name="star" size={16} filled/>{item.rating}</span>}</div>
  <p className="detail-intro">{item.description}</p>
  {hasFacts && <div className="detail-facts">
   {item.kind === 'events' && <div><Icon name="events"/><span><small>Когда</small><strong>{eventDate(item.dateOffset, true)} · {item.time}</strong></span></div>}
   {item.address && <div><Icon name="pin"/><span><small>{item.kind === 'services' ? 'Где работает' : 'Адрес'}</small><strong>{item.address}</strong></span></div>}
   {item.hours && <div><Icon name="clock"/><span><small>Часы работы</small><strong>{item.hours}{!item.real && ' · дни указаны ниже'}</strong>{item.real && <small className="hours-disclaimer">{hoursDisclaimer}</small>}</span></div>}
   {item.phone && <div><Icon name="phone"/><span><small>Телефон</small><a className="phone-link" href={phoneHref(item.phone)}>{item.phone}</a></span></div>}
   {item.price && <div><Icon name="services"/><span><small>{item.kind === 'places' ? 'Стоимость' : item.kind === 'events' ? 'Вход' : 'Ориентировочная цена'}</small><strong>{item.price}</strong></span></div>}
  </div>}
  {item.details && <section className="detail-description"><h2>{item.kind === 'events' ? 'Что тебя ждёт' : item.kind === 'places' ? 'О месте' : 'Об услуге'}</h2><p>{item.details}</p></section>}
  {item.real && item.kind === 'places' && <PlaceMap key={item.id} item={item} desktop={desktop}/>}
  {item.real ? <div className="place-source">{item.sourceType === 'user_provided' && <span>Данные предоставлены пользователем{item.verifiedAt ? ` · ${suppliedDate(item.verifiedAt)}` : ''}. Независимая проверка не проводилась.</span>}</div> : <div className="demo-note">Демонстрационная карточка. Все названия, адреса и оценки вымышлены. {item.kind === 'events' ? 'Билеты не продаются.' : 'Контакты и онлайн-запись пока недоступны.'}</div>}
  <button className={`primary-button detail-save ${saved ? 'is-saved' : ''}`} disabled={favoritesBusy} aria-pressed={saved} onClick={() => toggle(item.id)}><Icon name="heart" size={20} filled={saved}/>{saved ? 'Сохранено · убрать из избранного' : 'Добавить в избранное'}</button>
 </>;
 return <>
  <button className="back-link" onClick={goBack}><Icon name="back" size={18}/> Назад к подборке</button>
  {desktop && item.kind === 'places' ? <div className="web-place-layout"><div className="web-place-visual">{visual}</div><div className="web-place-content">{content}</div></div> : <>{visual}{content}</>}
 </>;
}
