import cityIllustration from '../assets/city.svg';
// A licensed photo can replace src without changing the cover/card layout.
export function MediaImage({ src, alt = '', eager = false }: { src: string; alt?: string; eager?: boolean }) {
  return <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={event => {
    const image = event.currentTarget;
    if (image.dataset.fallback) return;
    image.dataset.fallback = 'true';
    image.src = cityIllustration;
  }}/>;
}
export function PlaceMedia({ images }: { images: { src: string; alt: string }[] }) {
  return <div className={`place-media ${images.length > 1 ? 'has-gallery' : ''}`}>
    {images.map((image, index) => <div className="place-media-frame" key={`${image.src}/${index}`}><MediaImage {...image} eager={index === 0}/></div>)}
  </div>;
}
