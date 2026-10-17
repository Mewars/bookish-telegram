import { LegalLinks } from './legal/LegalLinks';
import { BrandWordmark } from './BrandWordmark';
import { brandAssets } from '../utils/brand';
import { FEDERAL_VK_COMMUNITY } from '../config/vkCommunity';

export function FooterBrand({ city, region, goHome }: { city: string; region: string; goHome: () => void }) {
  return <div className="footer-brand"><button className="brand brand-logo-pin" onClick={goHome} aria-label="Рядом — на главную"><BrandWordmark decorative/></button><p className="footer-slogan">Открывай город по-новому.</p><p className="footer-city">{city}, {region}</p></div>;
}

export function FooterCooperation({ showLegal = true }: { showLegal?: boolean }) {
  return <div className="footer-cooperation"><div className="footer-cooperation-links">
    <a href="https://vk.me/ryadomcity" target="_blank" rel="noopener noreferrer" aria-label="Франшиза — написать в сообщения сообщества РЯДОМ во ВКонтакте">Франшиза</a>
    <span aria-hidden="true">·</span>
    <a href="#/add-organization">Добавление организации</a>
    <span aria-hidden="true">·</span>
    <span title="Раздел готовится">Платные услуги</span>
  </div>
    <div className="footer-social">
      <h3>Мы в соцсетях:</h3>
      <a className="vk-link" href={FEDERAL_VK_COMMUNITY.url} target="_blank" rel="noopener noreferrer" aria-label="РЯДОМ во ВКонтакте (открыть в новой вкладке)">
        <img src={brandAssets.vk} width="28" height="28" alt=""/>ВКонтакте
      </a>
    </div>
    {showLegal && <LegalLinks/>}
  </div>;
}
