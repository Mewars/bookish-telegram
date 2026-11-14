export function createPhotoPlaceholder(doc=document){
 const block=doc.createElement('span');block.className='photo-placeholder';block.setAttribute('role','img');block.setAttribute('aria-label','Фото скоро появится');
 const logo=doc.createElement('img');logo.src='/brand/scarivo-winter.svg?v=soft1';logo.className='brand-logo-image';logo.alt='';logo.setAttribute('aria-hidden','true');
 const caption=doc.createElement('span');caption.className='photo-placeholder-caption';caption.textContent='Фото скоро появится';
 block.append(logo,caption);return block;
}
