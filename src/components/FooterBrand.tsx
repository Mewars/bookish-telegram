import { LegalLinks } from './legal/LegalLinks';
import { BrandWordmark } from './BrandWordmark';
import { brandAssets } from '../utils/brand';
import { FEDERAL_VK_COMMUNITY } from '../config/vkCommunity';

export function FooterBrand({ city, region, goHome }: { city: string; region: string; goHome: () => void }) {
  return <div className="footer-brand"><button className="brand brand-logo-pin" onClick={goHome} aria-label="Рядом — на главную"><BrandWordmark decorative/></button><p className="footer-slogan">Открывай город по-новому.</p><p className="footer-city">{city}, {region}</p></div>;
}

export function FooterCooperation({ showLegal = true }: { showLegal?: boolean }) {
  return <div className="footer-cooperation"><p>Франшиза · Добавление организации · Платные услуги</p><a className="vk-link" href={FEDERAL_VK_COMMUNITY.url} target="_blank" rel="noopener noreferrer" aria-label="Открыть федеральное сообщество РЯДОМ во ВКонтакте (новая вкладка)"><img src={brandAssets.vk} width="28" height="28" alt=""/>{FEDERAL_VK_COMMUNITY.label}</a>{showLegal && <LegalLinks/>}</div>;
}
