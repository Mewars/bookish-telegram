import type { Section } from '../types';
import { Icon, type IconName } from './Icon';
const tabs: { id: Section; label: string; icon: IconName }[] = [ { id: 'home', label: 'Главная', icon: 'home' }, { id: 'events', label: 'Афиша', icon: 'events' }, { id: 'places', label: 'Места', icon: 'places' }, { id: 'services', label: 'Услуги', icon: 'services' }, { id: 'profile', label: 'Профиль', icon: 'profile' } ];
export function Navigation({ section, navigate }: { section: Section; navigate: (section: Section) => void }) {
 return <nav className="bottom-nav" aria-label="Основная навигация">{tabs.map(tab => <button key={tab.id} className={(section === 'favorites' ? 'profile' : section) === tab.id ? 'active' : ''} aria-current={(section === 'favorites' ? 'profile' : section) === tab.id ? 'page' : undefined} onClick={() => navigate(tab.id)}><span><Icon name={tab.icon}/></span>{tab.label}</button>)}</nav>;
}
