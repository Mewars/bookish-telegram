export const cityCover = {
  src: `${(import.meta.env?.BASE_URL ?? '/')}brand/yeniseysk-winter-faces-v2.webp`,
  alt: 'Зимняя художественная обложка Енисейска: заснеженная набережная, памятник основателям и наряженная ель'
};

// Do not display an Eniseysk image as the cover of a different city.
// Only use a real city-specific cover after the administrator supplies it.
export function getCityCover(city: string, coverUrl?: string | null): { src: string; alt: string } | null {
  // Owner-approved seasonal cover for Eniseysk; never reuse it for another city.
  if (city === 'Енисейск') return cityCover;
  if (coverUrl) {
    try {
      const url = new URL(coverUrl);
      if (url.protocol === 'https:' && !url.username && !url.password) return { src: url.href, alt: `Обложка города ${city}` };
    } catch { /* A missing or invalid cover uses the neutral background. */ }
  }
  return null;
}
