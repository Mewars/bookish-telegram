import type { Section } from '../../types';
import { FooterBrand, FooterCooperation } from '../FooterBrand';
import { LegalLinks } from '../legal/LegalLinks';
export function WebFooter({ city, region, navigate }: { city: string; region: string; navigate: (section: Section) => void }) {
  return <footer className="web-footer"><div className="web-footer-inner">
    <FooterBrand city={city} region={region} goHome={() => navigate('home')}/>
    <div className="footer-column footer-legal"><h2>Информация</h2><LegalLinks/></div>
    <div className="footer-column"><h2>Сделаем город ближе</h2><FooterCooperation showLegal={false}/></div>
    <div className="web-footer-note"><span>© 2026 Рядом. Все права защищены.</span></div>
  </div></footer>;
}
