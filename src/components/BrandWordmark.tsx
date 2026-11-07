// Temporary neutral visual identity while the name is under trademark review.
// Keep the asset path and the site's existing routing/domain unchanged.
export function BrandWordmark({ decorative = false }: { decorative?: boolean }) {
  return <img className="brand-logo-image" src={`${import.meta.env.BASE_URL}brand/pin-yellow.svg`} width={2096} height={682} style={{ aspectRatio: '2096 / 682', objectFit: 'contain' }} alt={decorative ? '' : 'Городской портал'} aria-hidden={decorative || undefined}/>;
}
