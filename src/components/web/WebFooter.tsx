import type { Section } from '../../types';
import { FooterBrand, FooterCooperation } from '../FooterBrand';
import { TelegramLink } from './TelegramLink';

export function WebFooter({ city, navigate }: { city: string; navigate: (section: Section) => void }) {
  return <footer className="web-footer"><div className="web-footer-inner">
    <FooterBrand city={city} goHome={() => navigate('home')}/>
    <nav aria-label="Навигация в футере">{([{ id: 'home', label: 'Главная' }, { id: 'places', label: 'Места' }, { id: 'events', label: 'Афиша' }, { id: 'services', label: 'Услуги' }] as const).map(tab => <button key={tab.id} onClick={() => navigate(tab.id)}>{tab.label}</button>)}</nav>
    <TelegramLink/>
    <div className="web-footer-legal"><p>© 2026 Рядом. Все права защищены · est. 2026</p><FooterCooperation/></div>
    <div className="web-footer-note">Места — реальные. Афиша и услуги пока содержат демонстрационные данные.</div>
  </div></footer>;
}
