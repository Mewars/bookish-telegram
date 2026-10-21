export function createPhotoPlaceholder(doc=document){
 const block=doc.createElement('span');block.className='photo-placeholder';block.setAttribute('role','img');block.setAttribute('aria-label','Фото скоро появится');
 const pin=doc.createElement('img');pin.src='/brand/pin-yellow.svg';pin.alt='';pin.width=32;pin.height=32;pin.setAttribute('aria-hidden','true');
 const logo=doc.createElement('img');logo.src='/brand/ryadom-logo-transparent.png';logo.className='brand-logo-image';logo.alt='';logo.setAttribute('aria-hidden','true');
 const caption=doc.createElement('span');caption.className='photo-placeholder-caption';caption.textContent='Фото скоро появится';
 block.append(pin,logo,caption);return block;
}
