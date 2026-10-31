// Seasonal wrapper embeds the approved wordmark; the original PNG stays unchanged.
// Labelled navigation controls hide the image from assistive technology to avoid repetition.
export function BrandWordmark({ decorative = false }: { decorative?: boolean }) {
  return <img className="brand-logo-image" src={`${import.meta.env.BASE_URL}brand/ryadom-logo-winter-v2.svg`} width={2048} height={682} alt={decorative ? '' : 'Рядом'} aria-hidden={decorative || undefined}/>;
}
