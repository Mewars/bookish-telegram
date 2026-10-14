import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { validPhotoFile } from '../photos/adminImage';
import type { Classified } from './repository';
import {
  CLASSIFIED_PHOTO_LIMIT,deleteClassifiedPhoto,listClassifiedPhotos,
  signedClassifiedPhotos,uploadClassifiedPhotos,
} from './photos';
import type { VisiblePhoto } from './photos';

function explain(error:unknown):string{
  return error instanceof Error?error.message:'Не удалось обновить галерею.';
}
export function ClassifiedPhotoGallery({listing,editable}:{
  listing:Classified;editable:boolean;
}) {
  const [images,setImages]=useState<VisiblePhoto[]>([]);
  const [active,setActive]=useState(0);
  const [selected,setSelected]=useState<File[]>([]);
  const [rights,setRights]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    let alive=true;
    Promise.resolve().then(()=>listClassifiedPhotos(supabase,listing.id))
      .then(rows=>signedClassifiedPhotos(supabase,rows))
      .then(rows=>{if(alive){setImages(rows);setActive(0);setLoaded(true);}})
      .catch(reason=>{if(alive){setError(explain(reason));setLoaded(true);}});
    return ()=>{alive=false;};
  },[listing.id,listing.status,revision]);

  const upload=async()=>{
    if(busy||!editable||!rights||!selected.length)return;
    if(images.length+selected.length>CLASSIFIED_PHOTO_LIMIT){
      setError('Максимум 10 фотографий на объявление.');return;
    }
    if(selected.some(file=>!validPhotoFile(file))){
      setError('Выберите JPG, PNG, WebP или HEIC до 24 МБ.');return;
    }
    setBusy(true);setError('');
    try {
      await uploadClassifiedPhotos(supabase,listing.id,selected);
      setSelected([]);setRights(false);setRevision(n=>n+1);
    }catch(reason){setError(explain(reason));setRevision(n=>n+1);}
    finally{setBusy(false);}
  };
  const remove=async(photo:VisiblePhoto)=>{
    if(!editable||busy)return;
    setBusy(true);setError('');
    try{await deleteClassifiedPhoto(supabase,photo);setRevision(n=>n+1);}
    catch(reason){setError(explain(reason));}
    finally{setBusy(false);}
  };
  const current=images[Math.min(active,images.length-1)];
  if(!editable && images.length===0 && loaded && !error)return null;
  return <div className="classified-gallery" aria-label="Фотографии объявления">
    {current&&<div className="classified-gallery-main">
      <img src={current.url} alt={'Фото объявления «'+listing.title+'»'}/>
      {images.length>1&&<div className="classified-gallery-navigation">
        <button type="button" aria-label="Предыдущее фото" onClick={()=>setActive(i=>(i-1+images.length)%images.length)}>‹</button>
        <span>{Math.min(active,images.length-1)+1} / {images.length}</span>
        <button type="button" aria-label="Следующее фото" onClick={()=>setActive(i=>(i+1)%images.length)}>›</button>
      </div>}
    </div>}
    {images.length>1&&<div className="classified-gallery-thumbs">
      {images.map((photo,index)=><button key={photo.id} type="button" aria-label={'Фото '+(index+1)}
        aria-pressed={index===active} onClick={()=>setActive(index)}>
        <img src={photo.url} alt=""/>
      </button>)}
    </div>}
    {!loaded&&<p className="classifieds-note" role="status">Загружаем фотографии…</p>}
    {editable&&<div className="classified-gallery-edit">
      <small>Снимков: {images.length} из {CLASSIFIED_PHOTO_LIMIT}</small>
      {current&&<button className="classified-gallery-remove" type="button" disabled={busy}
        onClick={()=>void remove(current)}>Удалить выбранное фото</button>}
      {images.length<CLASSIFIED_PHOTO_LIMIT&&<>
        <label>Добавить фотографии
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            disabled={busy} onChange={event=>{setSelected(Array.from(event.target.files??[]));setRights(false);setError('');}}/>
        </label>
        {selected.length>0&&<>
          <small>Выбрано файлов: {selected.length}. Сохранение — до 2 МБ на фото, без геометок и EXIF.</small>
          <label className="classified-gallery-rights">
            <input type="checkbox" checked={rights} disabled={busy} onChange={e=>setRights(e.target.checked)}/>
            У меня есть право публиковать эти фотографии.
          </label>
          <button className="classifieds-main-action" type="button" disabled={!rights||busy||selected.length+images.length>CLASSIFIED_PHOTO_LIMIT}
            onClick={()=>void upload()}>{busy?'Загрузка…':'Загрузить фотографии'}</button>
        </>}
      </>}
      <small>Изменять фотографии можно только до отправки на модерацию.</small>
    </div>}
    {error&&<p role="alert" className="classifieds-feedback">{error}</p>}
  </div>;
}
