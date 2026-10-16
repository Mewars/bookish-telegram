import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { validPhotoFile } from '../photos/adminImage';
import type { Classified } from './repository';
import {
  CLASSIFIED_PHOTO_LIMIT,deleteClassifiedPhoto,listClassifiedPhotos,
  signedClassifiedPhotos,uploadClassifiedPhotos,
} from './photos';
import type { VisiblePhoto } from './photos';

// Signed Storage URLs expire after 600 seconds; refresh before expiry.
const PHOTO_URL_REFRESH_MS=9*60*1000;

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
  const [loadError,setLoadError]=useState('');
  const [revision,setRevision]=useState(0);
  const [loaded,setLoaded]=useState(false);
  const [signedAt,setSignedAt]=useState(0);
  useEffect(()=>{
    let alive=true;
    let signingStartedAt=0;
    Promise.resolve().then(()=>{
      if(!alive)return [];
      setLoaded(false);setLoadError('');
      return listClassifiedPhotos(supabase,listing.id);
    })
      .then(rows=>{
        if(!alive)return [];
        signingStartedAt=Date.now();
        return signedClassifiedPhotos(supabase,rows);
      })
      .then(rows=>{if(alive){setImages(rows);setActive(index=>Math.max(0,Math.min(index,rows.length-1)));setSignedAt(signingStartedAt);setLoaded(true);}})
      .catch(reason=>{if(alive){setLoadError(explain(reason));setLoaded(true);}});
    return ()=>{alive=false;};
  },[listing.id,listing.status,revision]);

  useEffect(()=>{
    if(!loaded||loadError||images.length===0)return;
    const refreshIfDue=()=>{
      if(document.visibilityState==='hidden'||Date.now()-signedAt<PHOTO_URL_REFRESH_MS)return;
      setLoaded(false);setRevision(n=>n+1);
    };
    const timeout=window.setTimeout(refreshIfDue,Math.max(0,PHOTO_URL_REFRESH_MS-(Date.now()-signedAt)));
    document.addEventListener('visibilitychange',refreshIfDue);
    window.addEventListener('focus',refreshIfDue);
    return ()=>{
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange',refreshIfDue);
      window.removeEventListener('focus',refreshIfDue);
    };
  },[loaded,loadError,images.length,signedAt]);

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
      const batch=selected;
      await uploadClassifiedPhotos(supabase,listing.id,batch,completed=>{
        setSelected(batch.slice(completed));
      });
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
  if(!loaded)return <p className="classifieds-note" role="status">Загружаем фотографии…</p>;
  if(loadError)return <div className="classified-gallery" aria-label="Фотографии объявления">
    <p role="alert" className="classifieds-feedback">{loadError}</p>
    <button type="button" onClick={()=>{setLoaded(false);setRevision(n=>n+1);}}>Повторить загрузку фотографий</button>
  </div>;
  const imageFailed=()=>setLoadError('Не удалось показать фотографию. Обновите ссылки и попробуйте снова.');
  const current=images[Math.min(active,images.length-1)];
  if(!editable && images.length===0 && loaded && !error)return null;
  return <div className="classified-gallery" aria-label="Фотографии объявления">
    {current&&<div className="classified-gallery-main">
      <img src={current.url} onError={imageFailed} alt={'Фото объявления «'+listing.title+'»'}/>
      {images.length>1&&<div className="classified-gallery-navigation">
        <button type="button" aria-label="Предыдущее фото" onClick={()=>setActive(i=>(i-1+images.length)%images.length)}>‹</button>
        <span>{Math.min(active,images.length-1)+1} / {images.length}</span>
        <button type="button" aria-label="Следующее фото" onClick={()=>setActive(i=>(i+1)%images.length)}>›</button>
      </div>}
    </div>}
    {images.length>1&&<div className="classified-gallery-thumbs">
      {images.map((photo,index)=><button key={photo.id} type="button" aria-label={'Фото '+(index+1)}
        aria-pressed={index===active} onClick={()=>setActive(index)}>
        <img src={photo.url} onError={imageFailed} alt=""/>
      </button>)}
    </div>}
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
