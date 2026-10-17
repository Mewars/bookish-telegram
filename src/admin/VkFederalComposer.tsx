import {useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {FEDERAL_VK_COMMUNITY} from '../config/vkCommunity';
/** Owner-only UI; production additionally requires an explicitly enabled Edge secret. */
export function VkFederalComposer(){
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 const [postUrl,setPostUrl]=useState('');
 const requestId=useRef<string|null>(null);
 const send=async()=>{
  if(busy||message.trim().length<20||message.trim().length>2500||!supabase)return;
  if(!window.confirm('Опубликовать этот текст от имени федеральной группы «РЯДОМ» во ВКонтакте? Публикация будет публичной.'))return;
  setBusy(true);setStatus('Проверяем права и отправляем…');setPostUrl('');
  try{
   requestId.current??=crypto.randomUUID();
   const {data,error}=await supabase.functions.invoke('vk-federal-publish',{
     body:{message:message.trim(),requestId:requestId.current}
   });
   if(error)throw Error('Сервер не подтвердил отправку. Если публикация не появилась, повторите с тем же текстом.');
   if(!data||data.ok!==true||typeof data.postUrl!=='string'||!/^https:\/\/vk\.ru\/wall-242202919_[0-9]+$/.test(data.postUrl)){
     throw Error('ВК не подтвердил создание публикации.');
   }
   setPostUrl(data.postUrl);setStatus('Публикация подтверждена ВКонтакте.');
   setMessage('');requestId.current=null;
  }catch(error){
   setStatus(error instanceof Error?error.message:'Отправка не подтверждена.');
   // Retain guid on failure: a repeated attempt should not duplicate an unknown post.
  }finally{setBusy(false);}
 };
 return <section className="admin-panel vk-federal-composer" aria-label="Публикации федеральной группы ВКонтакте">
   <h2>Федеральная группа ВК</h2>
   <p>Публикация от имени <a href={FEDERAL_VK_COMMUNITY.url} target="_blank" rel="noopener noreferrer">{FEDERAL_VK_COMMUNITY.label}</a> (ID {FEDERAL_VK_COMMUNITY.id}). Доступно только владельцу платформы после отдельного подключения VK API.</p>
   <label htmlFor="vk-federal-message">Текст публикации</label>
   <textarea id="vk-federal-message" value={message} disabled={busy} rows={6} maxLength={2500}
    placeholder="Напишите официальную новость о сервисе, подключении городов или партнёрстве…"
    onChange={event=>{setMessage(event.target.value);requestId.current=null;setStatus('');setPostUrl('');}}/>
   <small>{message.trim().length} / 2500 символов. Без автоматической отправки объявлений жителей.</small>
   <button type="button" className="primary-button" disabled={busy||message.trim().length<20||!supabase} onClick={()=>void send()}>
     {busy?'Отправляем…':'Подтвердить и опубликовать в ВК'}
   </button>
   {status&&<p role="status">{status}</p>}
   {postUrl&&<a href={postUrl} target="_blank" rel="noopener noreferrer">Открыть подтверждённую публикацию</a>}
 </section>;
}
