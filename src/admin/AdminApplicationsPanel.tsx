import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ApplicationRow} from '../organizations/model';
import type {CityAdminAccess} from './model';
import {decideOrganizationApplication,readPendingAdminApplications} from './repository';

export function AdminApplicationsPanel({client,userId,access,cityFilter,onEdit}:{
 client:SupabaseClient;userId:string;access:CityAdminAccess[];
 cityFilter:string;onEdit:(application:ApplicationRow)=>void;
}){
 const [rows,setRows]=useState<ApplicationRow[]|null>(null);
 const [error,setError]=useState('');
 const [attempt,setAttempt]=useState(0);
 const [rejecting,setRejecting]=useState<string|null>(null);
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
   let active=true;
   readPendingAdminApplications(client,userId,access)
    .then(result=>{if(active){setRows(result);setError('');}})
    .catch(failure=>{if(active){setError(failure instanceof Error?failure.message:'Ошибка загрузки заявок.');setRows([]);}});
   return ()=>{active=false;};
 },[client,userId,access,attempt]);
 const reject=async(app:ApplicationRow)=>{
   if(busy||reason.trim().length<10||!window.confirm('Отклонить заявку? Автор увидит причину отказа.'))return;
   setBusy(true);setError('');
   try{
     await decideOrganizationApplication(client,userId,access,app,'rejected',undefined,false,reason);
     setRows(current=>current?.filter(item=>item.id!==app.id)??[]);
     setRejecting(null);setReason('');
   }catch(e){setError(e instanceof Error?e.message:'Не удалось отклонить заявку.');}
   finally{setBusy(false);}
 };
 return <section className="admin-panel admin-requests-panel" aria-label="Входящие заявки на организации">
   <div className="admin-cms-panel-heading"><h2>Заявки на добавление организаций</h2>
     <button type="button" className="secondary-button" disabled={busy}
       onClick={()=>{setRows(null);setAttempt(value=>value+1);}}>Обновить заявки</button>
   </div>
   <p>Заявки поступают от жителей. Проверяй сведения и фотографии перед публикацией; на сайт они не попадают автоматически.</p>
   {error&&<p role="alert">{error}</p>}
   {!rows?<p role="status">Загружаем заявки…</p>:
    rows.filter(app=>cityFilter==='Все города'||app.city===cityFilter).length===0
      ?<p>Новых заявок в выбранном городе нет.</p>:
    <div className="admin-request-list">
      {rows.filter(app=>cityFilter==='Все города'||app.city===cityFilter).map(app=><article className="admin-request-item" key={app.id}>
        <div><strong>{app.title}</strong><small>{app.city} · {app.category} · {app.address}</small>
          <small>Отправлено: {new Date(app.created_at).toLocaleString('ru-RU')}</small>
          <p>{app.description}</p>
          {app.photo_path&&<small>Фотография приложена — откройте заявку, чтобы проверить снимок.</small>}
        </div>
        <div className="admin-request-actions">
          <button type="button" disabled={busy} className="primary-button" onClick={()=>onEdit(app)}>Проверить и редактировать</button>
          <button type="button" disabled={busy} className="secondary-button"
           onClick={()=>{setRejecting(rejecting===app.id?null:app.id);setReason('');}}>Отклонить</button>
        </div>
        {rejecting===app.id&&<div className="admin-request-reject">
          <label htmlFor={`request-reason-${app.id}`}>Причина отказа (не менее 10 символов)</label>
          <textarea id={`request-reason-${app.id}`} rows={3} maxLength={1000}
           value={reason} onChange={event=>setReason(event.target.value)}/>
          <button type="button" className="secondary-button" disabled={busy||reason.trim().length<10}
           onClick={()=>void reject(app)}>Подтвердить отклонение</button>
        </div>}
      </article>)}
    </div>}
 </section>;
}
