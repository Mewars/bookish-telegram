import { LegalLinks } from './legal/LegalLinks';
import { BrandWordmark } from './BrandWordmark';
import { brandAssets } from '../utils/brand';

export function FooterBrand({ city, goHome }: { city: string; goHome: () => void }) {
  return <div className="footer-brand"><button className="brand brand-logo-pin" onClick={goHome} aria-label="Рядом — на главную"><BrandWordmark/></button><p className="footer-slogan">Открывай город по-новому.</p><p className="footer-city">{city}, Красноярский край</p></div>;
}

export function FooterCooperation({ showLegal = true }: { showLegal?: boolean }) {
  return <div className="footer-cooperation"><p>Франшиза · Добавление организации · Платные услуги</p><a className="vk-link" href="https://vk.ru/mewarspro" target="_blank" rel="noopener noreferrer"><img src={brandAssets.vk} width="28" height="28" alt=""/>По вопросам сотрудничества — VK</a>{showLegal && <LegalLinks/>}</div>;
}
