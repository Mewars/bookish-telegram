// Temporary neutral visual identity while the name is under trademark review.
// Keep the asset path and the site's existing routing/domain unchanged.
export function BrandWordmark({ decorative = false }: { decorative?: boolean }) {
  return <img className="brand-logo-image" src={`${import.meta.env.BASE_URL}brand/pin-yellow.svg`} width={44} height={44} alt={decorative ? '' : 'Городской портал'} aria-hidden={decorative || undefined}/>;
}
