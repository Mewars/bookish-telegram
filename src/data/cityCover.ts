import {winterTime} from '../home/winterTime.ts';
export const cityCover = {
  src: `${(import.meta.env?.BASE_URL ?? '/')}brand/yeniseysk-winter-churches-on.webp`,
  alt: 'Зимняя художественная обложка Енисейска: заснеженная набережная, памятник основателям и наряженная ель'
};

const lampsOffCover = { ...cityCover, src: `${(import.meta.env?.BASE_URL ?? '/')}brand/yeniseysk-winter-churches-off.webp` };
const lesosibirskCover = {
  src: `${(import.meta.env?.BASE_URL ?? '/')}brand/lesosibirsk-winter-v2-on.webp`,
  alt: 'Зимняя художественная обложка Лесосибирска: Крестовоздвиженский собор, мост через Енисей и въездной знак города'
};
const lesosibirskLampsOffCover = { ...lesosibirskCover, src: `${(import.meta.env?.BASE_URL ?? '/')}brand/lesosibirsk-winter-v2-off.webp` };
export function winterLampsOn(now: Date): boolean { return winterTime(now).lampsOn; }

// Do not display an Eniseysk image as the cover of a different city.
// Use owner-approved seasonal art, an administrator-supplied cover, or a neutral scene.
export function getCityCover(city: string, coverUrl?: string | null, now = new Date()): { src: string; alt: string } | null {
  // Seasonal backgrounds are approved separately for each city.
  if (city === 'Енисейск') return winterLampsOn(now) ? cityCover : lampsOffCover;
  if (city === 'Лесосибирск') return winterLampsOn(now) ? lesosibirskCover : lesosibirskLampsOffCover;
  if (coverUrl) {
    try {
      const url = new URL(coverUrl);
      if (url.protocol === 'https:' && !url.username && !url.password) return { src: url.href, alt: `Обложка города ${city}` };
    } catch { /* A missing or invalid cover uses the neutral background. */ }
  }
  return null;
}
