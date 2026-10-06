import type { Item } from '../types';
import { eventDate } from '../utils/date';
import { hoursDisclaimer } from '../utils/place';
import { Icon } from './Icon';
export interface CardActions { favorites: string[]; favoritesBusy?: boolean; toggle: (id: string) => void; open: (item: Item) => void }
export function Card({ item, favorites, toggle, open, favoritesBusy = false, compact = false }: CardActions & { item: Item; compact?: boolean }) {
 const saved = favorites.includes(item.id);
 const address = item.kind === 'events' ? item.address?.split(',')[0] : item.address;
 return <article data-kind={item.kind} className={`card ${compact ? 'compact' : ''} ${item.real ? 'card-real' : ''}`}>
  <button className="card-open" onClick={() => open(item)} aria-label={`Подробнее: ${item.title}`}>
   <div className="card-image"><img src={item.image} alt="" loading="lazy"/>{item.label && <span className="image-label">{item.label}</span>}{item.kind === 'events' && <span className="date-label">{eventDate(item.dateOffset)} <span>· {item.time}</span></span>}</div>
   <div className="card-body"><div className="card-eyebrow"><span>{item.category}</span>{!item.real && item.rating && <span className="rating"><Icon name="star" size={13} filled/>{item.rating}</span>}</div>
    <h3>{item.title}</h3><p>{item.description}</p>
    {item.kind === 'services' ? item.provider && <div className="card-meta"><span>{item.provider}</span></div> : address && <div className="card-meta"><Icon name="pin" size={14}/><span>{address}</span></div>}
    {(item.kind !== 'places' || item.price || item.hours) && <div className="card-footer">{item.price && <strong>{item.price}</strong>}{item.kind === 'places' ? item.hours && <span><Icon name="clock" size={13}/>{item.hours}</span> : <Icon name="arrow" size={18}/>}</div>}
    {item.real && item.hours && <small className="hours-disclaimer">{hoursDisclaimer}</small>}
   </div>
  </button>
  <button className={`favorite-button ${saved ? 'saved' : ''}`} disabled={favoritesBusy} onClick={() => toggle(item.id)} aria-pressed={saved} aria-label={`${saved ? 'Удалить из избранного' : 'В избранное'}: ${item.title}`}><Icon name="heart" size={19} filled={saved}/></button>
 </article>;
}
