import {useEffect,useRef,useState} from 'react';
import type {NearbyClient} from './repository';
import {nearbyCall} from './repository';
type Resident={id:string;name:string;city:string;relation:'none'|'accepted'|'incoming'|'outgoing'};
export function ResidentDirectory({client,city,name,publicCity,refresh,openRequests}:{client:NearbyClient|null;city:string;name:string;publicCity:string|null;refresh:()=>Promise<void>;openRequests:()=>void}){
 const [query,setQuery]=useState(''),[rows,setRows]=useState<Resident[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [peer,setPeer]=useState(()=>new URLSearchParams(window.location.hash.split('?')[1]||'').get('peer')||'');
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
 const search=async()=>{if(busy)return;setBusy(true);setNotice('');try{const result=await nearbyCall<Resident[]>(client,'nearby_directory',{p_city:city,p_search:query.trim(),p_peer:peer});if(alive.current){setRows(result);if(!result.length)setNotice(peer?'Житель не включил поиск в этом городе или сейчас недоступен.':'Жителей, разрешивших поиск с таким именем, пока нет.');}}catch(e){if(alive.current)setNotice(e instanceof Error?e.message:'Не удалось загрузить жителей.');}finally{if(alive.current)setBusy(false);}};
 const change=async(action:()=>Promise<unknown>,message:string)=>{if(busy)return;setBusy(true);setNotice('');try{await action();if(!alive.current)return;await refresh();if(alive.current){setRows([]);setNotice(message);}}catch(e){if(alive.current)setNotice(e instanceof Error?e.message:'Не удалось выполнить действие.');}finally{if(alive.current)setBusy(false);}};
 return <section className="friends-card"><h2>Найти жителей и добавить в друзья</h2><p>Поиск показывает только тех, кто сам разрешил находить себя. Виден выбранный город и имя. Геолокация остаётся отдельной настройкой.</p>
 {notice&&<p className="friends-notice" role="status">{notice}</p>}
 <p>{publicCity?`Ваш профиль доступен в поиске города: ${publicCity}.`:'Ваш профиль скрыт из поиска.'}</p>
 {publicCity===city?<button disabled={busy} className="friends-secondary" onClick={()=>void change(()=>nearbyCall(client,'nearby_directory_opt_in',{p_enabled:false}),'Вы скрыты из поиска. Подтверждённые друзья сохранены.')}>Скрыть меня из поиска</button>:<button disabled={busy||name.trim().length<2||name.trim().length>40} onClick={()=>void change(()=>nearbyCall(client,'nearby_directory_opt_in',{p_enabled:true,p_city:city,p_name:name.trim()}),'Профиль доступен жителям в поиске выбранного города.')}>Разрешить находить меня в этом городе</button>}
 <form onSubmit={e=>{e.preventDefault();void search();}}><label>Имя жителя<input maxLength={40} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Имя или псевдоним"/></label>{peer&&<p>Вы перешли к автору записи или комментария. <button type="button" className="friends-secondary" disabled={busy} onClick={()=>{setPeer('');setRows([]);setNotice('');}}>Искать всех жителей</button></p>}<button disabled={busy} type="submit">{peer?'Найти автора':'Найти жителей'}</button></form>
 {rows.map(row=><article className="friend-row" key={row.id}><h3>{row.name}</h3><p>{row.city}</p>{row.relation==='none'?<button disabled={busy||name.trim().length<2} onClick={()=>void change(()=>nearbyCall(client,'nearby_request_person',{p_peer:row.id,p_name:name.trim()}),'Заявка отправлена. Дружба начнётся после подтверждения.')}>Добавить в друзья</button>:row.relation==='incoming'?<button onClick={openRequests}>Входящая заявка — открыть</button>:<p>{row.relation==='accepted'?'В друзьях':'Заявка отправлена'}</p>}</article>)}
 </section>;
}
