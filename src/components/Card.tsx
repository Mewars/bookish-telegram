import type { Item } from '../types';
import { eventDate } from '../utils/date';
import { Icon } from './Icon';
export interface CardActions { favorites: string[]; toggle: (id: string) => void; open: (item: Item) => void }
export function Card({ item, favorites, toggle, open, compact = false }: CardActions & { item: Item; compact?: boolean }) {
 const saved = favorites.includes(item.id);
 return <article className={`card ${compact ? 'compact' : ''}`}>
  <button className="card-open" onClick={() => open(item)} aria-label={`Подробнее: ${item.title}`}>
   <div className="card-image"><img src={item.image} alt="" loading="lazy"/>{item.label && <span className="image-label">{item.label}</span>}{item.kind === 'events' && <span className="date-label">{eventDate(item.dateOffset)} <span>· {item.time}</span></span>}</div>
   <div className="card-body"><div className="card-eyebrow"><span>{item.category}</span>{item.rating && <span className="rating"><Icon name="star" size={13} filled/>{item.rating}</span>}</div>
    <h3>{item.title}</h3><p>{item.description}</p>
    <div className="card-meta">{item.kind === 'events' ? <><Icon name="pin" size={14}/><span>{item.address.split(',')[0]}</span></> : item.kind === 'places' ? <><Icon name="pin" size={14}/><span>{item.address}</span></> : <span>{item.provider}</span>}</div>
    <div className="card-footer"><strong>{item.price}</strong>{item.kind === 'places' ? <span><Icon name="clock" size={13}/>{item.hours}</span> : <Icon name="arrow" size={18}/>}</div>
   </div>
  </button>
  <button className={`favorite-button ${saved ? 'saved' : ''}`} onClick={() => toggle(item.id)} aria-pressed={saved} aria-label={`${saved ? 'Удалить из избранного' : 'В избранное'}: ${item.title}`}><Icon name="heart" size={19} filled={saved}/></button>
 </article>;
}
