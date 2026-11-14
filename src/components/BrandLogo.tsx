import './brandLogo.css';

export function BrandLogo({ animated = false, decorative = false, seasonal = true }: {
  animated?: boolean; decorative?: boolean; seasonal?: boolean;
}) {
  const base = `${import.meta.env.BASE_URL}brand/`;
  const version = '?v=vstrechay1';
  return <span className={`brand-logo-image scarivo-logo${animated ? ' scarivo-logo--animated' : ''}`}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'Встречай'} aria-hidden={decorative || undefined}>
    <picture className="scarivo-logo__word scarivo-logo__word--dark">
      <source media="(max-width: 599px)" srcSet={`${base}vstrechay-wordmark-compact.svg${version}`}/>
      <img className="scarivo-logo__letters" src={`${base}scarivo-letters-soft-v1.svg${version}`} width={562} height={150} alt=""/>
    </picture>
    <picture className="scarivo-logo__word scarivo-logo__word--light">
      <source media="(max-width: 599px)" srcSet={`${base}vstrechay-wordmark-compact-light.svg${version}`}/>
      <img className="scarivo-logo__letters" src={`${base}vstrechay-wordmark-light.svg${version}`} width={562} height={150} alt=""/>
    </picture>
    <span className="scarivo-logo__pin">
      <img src={`${base}scarivo-pin-winter.svg${version}`} width={92} height={150} alt=""/>
      {seasonal && <img className="scarivo-logo__hat" src={`${base}vstrechay-hat.svg${version}`} width={92} height={150} alt=""/>}
    </span>
  </span>;
}
