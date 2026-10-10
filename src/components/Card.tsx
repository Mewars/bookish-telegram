import type { Item } from '../types';
import { eventDate } from '../utils/date';
import { Icon } from './Icon';
import { MediaImage } from './MediaImage';
export interface CardActions { favorites: string[]; favoritesBusy?: boolean; toggle: (id: string) => void; open: (item: Item) => void }
export function Card({ item, favorites, toggle, open, favoritesBusy = false, compact = false }: CardActions & { item: Item; compact?: boolean }) {
  const saved = favorites.includes(item.id);
  const address = item.kind === 'events' ? item.address?.split(',')[0] : item.address;
  return <article data-kind={item.kind} className={`card ${compact ? 'compact' : ''} ${item.real ? 'card-real' : ''}`}>
    <button className="card-open" onClick={() => open(item)} aria-label={`Подробнее: ${item.title}`}><div className="card-image"><MediaImage src={item.image}/>
      {item.label && <span className="image-label">{item.label}</span>}
      {item.kind === 'events' && <span className="date-label">{eventDate(item.dateOffset)} <span>· {item.time}</span></span>}
      {!item.real && <span className="demo-label">Демо</span>}
    </div></button>
    <div className="card-body"><div className="card-eyebrow"><span>{item.category}</span><button className={`favorite-button ${saved ? 'saved' : ''}`} disabled={favoritesBusy} onClick={() => toggle(item.id)} aria-pressed={saved} aria-label={`${saved ? 'Удалить из избранного' : 'В избранное'}: ${item.title}`}><Icon name="heart" size={19} filled={saved}/></button></div>
      <button className="card-title-button" onClick={() => open(item)} aria-label={`Открыть: ${item.title}`}><h3>{item.title}</h3></button><p>{item.description}</p>
      {item.kind === 'services' ? item.provider && <div className="card-meta"><Icon name="profile" size={14}/><span>{item.provider}</span></div> : address && <div className="card-meta"><Icon name="pin" size={14}/><span>{address}</span></div>}
      {(item.price || item.hours || (!item.real && item.rating)) && <div className="card-footer">{item.price && <strong>{item.price}</strong>}{item.hours && <span><Icon name="clock" size={13}/>{item.hours}</span>}{!item.real && item.rating && <span><Icon name="star" size={13} filled/>{item.rating} · демо</span>}</div>}
    </div>
  </article>;
}
