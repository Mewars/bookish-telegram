// Brand presentation only. Keep technical routes, OAuth, database and localStorage keys stable.
// The winter illustration is an original self-contained SVG (gold geolocation pin and Santa hat).
export function BrandWordmark({ decorative = false }: { decorative?: boolean }) {
  return <img className="brand-logo-image" src={`${import.meta.env.BASE_URL}brand/scarivo-winter.svg`} width={496} height={128} alt={decorative ? '' : 'Scarivo'} aria-hidden={decorative || undefined}/>;
}
