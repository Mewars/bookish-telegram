import { LegalLinks } from './legal/LegalLinks';
import { BrandMark } from './BrandMark';
import { brandAssets } from '../utils/brand';

export function FooterBrand({ city, goHome }: { city: string; goHome: () => void }) {
  return <div className="footer-brand"><button className="brand" onClick={goHome} aria-label="Рядом — на главную">РЯДОМ<BrandMark/></button><p className="footer-slogan">Город ближе, чем кажется.</p><p className="footer-city">{city}, Красноярский край</p></div>;
}

export function FooterCooperation({ showLegal = true }: { showLegal?: boolean }) {
  return <div className="footer-cooperation"><p>Франшиза · Добавление организации · Платные услуги</p><a className="vk-link" href="https://vk.ru/mewarspro" target="_blank" rel="noopener noreferrer"><img src={brandAssets.vk} width="28" height="28" alt=""/>По вопросам сотрудничества — VK</a>{showLegal && <LegalLinks/>}</div>;
}
