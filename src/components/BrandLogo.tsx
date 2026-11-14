import './brandLogo.css';

export function BrandLogo({ animated = false, decorative = false }: { animated?: boolean; decorative?: boolean }) {
  const base = `${import.meta.env.BASE_URL}brand/`;
  return <span className={`brand-logo-image scarivo-logo${animated ? ' scarivo-logo--animated' : ''}`}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'Scarivo'} aria-hidden={decorative || undefined}>
    <img className="scarivo-logo__letters" src={`${base}scarivo-letters.svg`} width={360} height={117} alt=""/>
    <span className="scarivo-logo__pin"><img src={`${base}scarivo-pin-winter.svg`} width={82} height={117} alt=""/></span>
  </span>;
}
