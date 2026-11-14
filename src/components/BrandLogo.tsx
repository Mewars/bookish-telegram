import { useEffect, useRef, useState } from 'react';
import './brandLogo.css';

export function BrandLogo({ animated = false, decorative = false, seasonal = true, holidayMode = seasonal }: {
  animated?: boolean; decorative?: boolean; seasonal?: boolean; holidayMode?: boolean;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!animated) return;
    let active = true;
    const images = Array.from(root.current?.querySelectorAll('img') ?? []);
    void Promise.all(images.map(image => image.decode().catch(() => undefined)))
      .then(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [animated, holidayMode]);
  const base = `${import.meta.env.BASE_URL}brand/`;
  const version = '?v=vstrechay2';
  return <span ref={root} className={`brand-logo-image scarivo-logo${animated ? ' scarivo-logo--animated' : ''}${animated && !ready ? ' scarivo-logo--loading' : ''}`}
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
