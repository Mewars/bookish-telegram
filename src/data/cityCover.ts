export const cityCover = {
  src: `${import.meta.env.BASE_URL}brand/yeniseysk-hero-final.jpg`,
  alt: 'Стилизованный вид Енисейска на закате: набережная, памятник основателям и историческая архитектура'
};

// Do not display an Eniseysk image as the cover of a different city.
// Only use a real city-specific cover after the administrator supplies it.
export function getCityCover(city: string, coverUrl?: string | null): { src: string; alt: string } | null {
  if (coverUrl) {
    try {
      const url = new URL(coverUrl);
      if (url.protocol === 'https:' && !url.username && !url.password) return { src: url.href, alt: `Обложка города ${city}` };
    } catch { /* A missing or invalid cover uses the neutral background. */ }
  }
  return city === 'Енисейск' ? cityCover : null;
}
