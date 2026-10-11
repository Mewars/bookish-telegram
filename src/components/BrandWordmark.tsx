// The approved PNG is kept byte-for-byte; CSS only scales its display size.
// Labelled navigation controls hide the image from assistive technology to avoid repetition.
export function BrandWordmark({ decorative = false }: { decorative?: boolean }) {
  return <img className="brand-logo-image" src={`${import.meta.env.BASE_URL}brand/ryadom-logo-transparent.png`} width={2048} height={682} alt={decorative ? '' : 'Рядом'} aria-hidden={decorative || undefined}/>;
}
