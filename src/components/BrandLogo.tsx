import './brandLogo.css';

export function BrandLogo({ animated = false, decorative = false, seasonal = true, holidayMode = seasonal }: {
  animated?: boolean; decorative?: boolean; seasonal?: boolean; holidayMode?: boolean;
}) {
  const base = `${import.meta.env.BASE_URL}brand/`;
  const version = '?v=vstrechay2';
  return <span className={`brand-logo-image scarivo-logo${animated ? ' scarivo-logo--animated' : ''}`}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'Встречай'} aria-hidden={decorative || undefined}>
    <picture className="scarivo-logo__word">
      <source media="(max-width: 599px)" srcSet={`${base}vstrechay-wordmark-compact.webp${version}`}/>
      <img className="scarivo-logo__letters" src={`${base}vstrechay-wordmark.webp${version}`} width={562} height={150} alt=""/>
    </picture>
    <span className="scarivo-logo__pin">
      <img className={holidayMode ? 'scarivo-logo__hat' : undefined}
        src={`${base}${holidayMode ? 'vstrechay-pin-holiday.webp' : 'vstrechay-pin-plain.webp'}${version}`}
        width={112} height={150} alt=""/>
    </span>
  </span>;
}
