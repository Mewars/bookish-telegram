import type { Section } from '../../types';
import { FooterBrand, FooterCooperation } from '../FooterBrand';
import { LegalLinks } from '../legal/LegalLinks';
export function WebFooter({ city, region, navigate }: { city: string; region: string; navigate: (section: Section) => void }) {
  return <footer className="web-footer"><div className="web-footer-inner">
    <FooterBrand city={city} region={region} goHome={() => navigate('home')}/>
    <div className="footer-column"><h2>Открывай город</h2><nav className="footer-navigation" aria-label="Навигация в футере">{([{ id: 'home', label: 'Главная' }, { id: 'places', label: 'Места' }, { id: 'events', label: 'Афиша' }, { id: 'services', label: 'Услуги' }] as const).map(tab => <button key={tab.id} onClick={() => navigate(tab.id)}>{tab.label}</button>)}<button onClick={() => navigate('admin')}>Административная панель</button></nav></div>
    <div className="footer-column footer-legal"><h2>Информация</h2><LegalLinks/></div>
    <div className="footer-column"><h2>Сделаем город ближе</h2><FooterCooperation showLegal={false}/></div>
    <div className="web-footer-note"><span>© 2026 Рядом. Все права защищены.</span></div>
  </div></footer>;
}
