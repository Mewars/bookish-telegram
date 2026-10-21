import { isLegacyIllustration } from './mediaSource';
import { useState } from 'react';
import { Icon } from './Icon';
import { BrandWordmark } from './BrandWordmark';
import '../../public/catalog/photo-placeholder.css';

export function PhotoPlaceholder() {
  return <span className="photo-placeholder" role="img" aria-label="Фото скоро появится">
    <span className="photo-placeholder-pin" aria-hidden="true"><Icon name="pin" size={32}/></span>
    <BrandWordmark decorative/>
    <span className="photo-placeholder-caption">Фото скоро появится</span>
  </span>;
}
function ImageSource({ src, alt, eager }: { src: string; alt: string; eager: boolean }) {
  const [failed,setFailed] = useState(false);
  if (!src || isLegacyIllustration(src) || failed) return <PhotoPlaceholder/>;
  return <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={()=>setFailed(true)}/>;
}
export function MediaImage({ src = '', alt = '', eager = false }: { src?: string; alt?: string; eager?: boolean }) {
  return <ImageSource key={src} src={src} alt={alt} eager={eager}/>;
}
export function PlaceMedia({ images }: { images: { src: string; alt: string }[] }) {
  const available=images.length?images:[{src:'',alt:''}];
  return <div className={`place-media ${available.length > 1 ? 'has-gallery' : ''}`}>
    {available.map((image, index) => <div className="place-media-frame" key={`${image.src}/${index}`}><MediaImage {...image} eager={index === 0}/></div>)}
  </div>;
}
