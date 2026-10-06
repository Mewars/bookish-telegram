import type { Section } from '../../types';
import { TelegramLink } from './TelegramLink';

export function WebFooter({ city, navigate }: { city: string; navigate: (section: Section) => void }) {
  return <footer className="web-footer"><div className="web-footer-inner">
    <div><button className="brand" onClick={() => navigate('home')} aria-label="Рядом — на главную">рядом<span>✳</span></button><p>{city}, Красноярский край</p></div>
    <nav aria-label="Навигация в футере">{([{ id: 'home', label: 'Главная' }, { id: 'places', label: 'Места' }, { id: 'events', label: 'Афиша' }, { id: 'services', label: 'Услуги' }] as const).map(tab => <button key={tab.id} onClick={() => navigate(tab.id)}>{tab.label}</button>)}</nav>
    <TelegramLink/>
    <div className="web-footer-note">Места — реальные. Афиша и услуги пока содержат демонстрационные данные.<span>Для тех, кто любит свой город.</span></div>
  </div></footer>;
}
