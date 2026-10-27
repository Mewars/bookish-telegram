import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { activePoint, approximateCoordinates, getNearbyState, nearbyCall } from './repository';
import type { NearbyState } from './repository';
import { FriendsMap } from './FriendsMap';
import { createHostNearbyClient } from './hostClient';
import './friends.css';
import {ResidentDirectory} from './ResidentDirectory';
const nearby=import.meta.env.VITE_FRIENDS_BACKEND==='host'?createHostNearbyClient(supabase,`${import.meta.env.BASE_URL}api/friends.php`):supabase;

const message=(reason:unknown)=>reason instanceof Error?reason.message:'Не удалось выполнить действие.';
const localTime=(value:string)=>new Date(value).toLocaleTimeString('ru-RU',{timeZone:'Asia/Krasnoyarsk',hour:'2-digit',minute:'2-digit'});
export function FriendsPage({city,openLogin}:{city:string;openLogin:()=>void}) {
  const {state}=useAuth();
  const userId=state.status==='authenticated'?state.user.id:null;
  return <FriendsSession key={userId??'guest'} userId={userId} city={city} openLogin={openLogin}/>;
}

function FriendsSession({userId,city,openLogin}:{userId:string|null;city:string;openLogin:()=>void}) {
  const [data,setData]=useState<NearbyState|null>(null);
  const [name,setName]=useState('');
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState(false);
  const [locating,setLocating]=useState(false);
  const [notice,setNotice]=useState('');
  const [now,setNow]=useState(()=>Date.now());
  const alive=useRef(true);
  const generation=useRef(0);
  const loads=useRef(0);
  useEffect(()=>{
    alive.current=true;++generation.current;++loads.current;
    let querying=false;
    const load=async()=>{
      if(!userId||querying||document.visibilityState!=='visible')return;
      querying=true;const epoch=++loads.current;
      try {const result=await getNearbyState(nearby);if(alive.current&&loads.current===epoch)setData(result);}
      catch(reason){if(alive.current&&loads.current===epoch){setData(null);setNotice(message(reason));}}
      finally{querying=false;}
    };
    void load();
    const interval=window.setInterval(()=>{void load();},30000);
    const clock=window.setInterval(()=>setNow(Date.now()),5000);
    const resume=()=>{if(document.visibilityState==='visible')void load();};
    document.addEventListener('visibilitychange',resume);
    return ()=>{alive.current=false;window.clearInterval(interval);window.clearInterval(clock);document.removeEventListener('visibilitychange',resume);};
  },[userId]);
  const refresh=async()=>{
    const epoch=++loads.current;
    const result=await getNearbyState(nearby);
    if(alive.current&&epoch===loads.current)setData(result);
  };
  const run=async(action:()=>Promise<unknown>,success?:string)=>{
    if(busy)return;
    setBusy(true);setNotice('');
    try {await action();if(!alive.current)return;await refresh();if(success&&alive.current)setNotice(success);}
    catch(reason){if(alive.current)setNotice(message(reason));}
    finally{if(alive.current)setBusy(false);}
  };
  const hide=async()=>{
    ++generation.current;setLocating(false);setNotice('Скрываем точку…');
    try {await nearbyCall(nearby,'nearby_hide');if(!alive.current)return;++loads.current;
      setData(current=>current?{...current,self:{...current.self,latitude:null,longitude:null,expires_at:null}}:null);
      setNotice('Вы невидимы. Публикация местоположения отключена.');await refresh();}
    catch {if(alive.current)setNotice('Не удалось подтвердить скрытие точки. Проверьте соединение и нажмите «Стать невидимым» ещё раз.');}
  };
  const share=async()=>{
    if(locating||busy)return;
    if(!navigator.geolocation){setNotice('Этот браузер не поддерживает геолокацию.');return;}
    const epoch=++generation.current;setLocating(true);setNotice('');
    try {
      const token=await nearbyCall<string>(nearby,'nearby_start_sharing');
      if(!alive.current||generation.current!==epoch)return;
      const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:15000,maximumAge:0}));
      if(!alive.current||generation.current!==epoch)return;
      const coordinates=approximateCoordinates(position.coords.latitude,position.coords.longitude);
      await nearbyCall(nearby,'nearby_share',{...coordinates,p_token:token});
      if(!alive.current||generation.current!==epoch)return;
      await refresh();if(alive.current)setNotice('Приблизительная точка видна подтверждённым друзьям один час.');
    } catch(reason){
      if(alive.current&&generation.current===epoch){
        try {await nearbyCall(nearby,'nearby_hide');await refresh();}catch { /* The server consent grant expires even if cancellation cannot connect. */ }
        if(alive.current)setNotice(reason instanceof Error?message(reason):'Доступ к местоположению не получен. Разрешите его в браузере и повторите.');
      }
    } finally {if(alive.current&&generation.current===epoch)setLocating(false);}
  };
  const displayName=name.trim()||data?.self.display_name||'';
  const visible=!!data&&activePoint(data.self,now);
  const friends=data?.friends.filter(friend=>friend.accepted)??[];
  const pending=data?.friends.filter(friend=>!friend.accepted)??[];
  return <div className="friends-page ym-disable-keys ym-disable-clicks ym-disable-webvisor">
    <header className="friends-heading"><span className="eyebrow">ТВОИ ЛЮДИ В ГОРОДЕ</span><h1>Друзья рядом</h1><p>Добавляйте знакомых и делитесь приблизительной точкой, когда сами этого хотите.</p></header>
    {!userId?<section className="friends-card"><h2>Здесь только ваши друзья</h2><p>Войдите, чтобы обменяться приглашениями. Геолокация по умолчанию выключена.</p><button onClick={openLogin}>Войти в аккаунт</button></section>:<>
      {notice&&<p className="friends-notice" role="status">{notice}</p>}
      <section className="friends-card friends-visibility"><div><span className={visible?'friends-status visible':'friends-status'}>{visible?`Вас видно до ${localTime(data!.self.expires_at!)}`:data?'Вы невидимы':'Проверяем видимость…'}</span>
        <h2>Вы решаете, когда быть рядом</h2><p>Одна приблизительная точка на один час для всех подтверждённых друзей, включая добавленных в течение этого часа. Точка не обновляется в фоне и исчезает по окончании срока, даже если закрыть страницу.</p></div>
        <button disabled={busy||locating||!data} onClick={()=>void share()}>{locating?'Определяем местоположение…':visible?'Обновить точку на один час':'Показать друзьям на один час'}</button>
        <button className="friends-secondary" onClick={()=>void hide()}>{locating?'Отменить и стать невидимым':'Стать невидимым'}</button>
        <small>Точное положение округляется ещё до отправки. Друзья видят область примерно в один километр; публичного поиска людей нет.</small>
        {import.meta.env.VITE_FRIENDS_BACKEND==='host'&&<details><summary>Условия показа местоположения</summary><p>Нажимая «Показать друзьям на один час», вы разрешаете оператору «Рядом» обработать одну приблизительную точку и показать её всем подтверждённым друзьям. Скрыть точку и отозвать согласие можно кнопкой «Стать невидимым».</p><p>Имена для друзей, приглашения, связи и точки хранятся на сервере сайта у Спринтхост в России. Геопозиция не передаётся в Supabase. Показ прекращается через час; очистка истёкших точек запускается каждые пять минут. Подробности — в <a href="#/privacy">политике обработки данных</a>.</p></details>}
      </section>
      {data&&<FriendsMap key={`map-${city}`} city={city} data={data} now={now}/>}
      <section className="friends-card"><h2>Пригласить знакомого</h2><label>Как вас увидят друзья<input maxLength={40} minLength={2} placeholder="Имя или псевдоним" value={name} onChange={event=>setName(event.target.value)}/></label>
        <button disabled={busy||displayName.length<2||displayName.length>40} onClick={()=>void run(()=>nearbyCall(nearby,'nearby_invite',{p_name:displayName}),'Новый код готов. Предыдущий код больше не действует.')}>Создать личный код</button>
        {data?.self.invite_code&&<div className="friends-invite"><label>Ваш код друга<input aria-label="Ваш код друга" readOnly value={data.self.invite_code} onFocus={event=>event.target.select()}/></label>
          <button className="friends-secondary" onClick={()=>{void navigator.clipboard?.writeText(data.self.invite_code!).then(()=>setNotice('Код скопирован.'),()=>setNotice('Выделите и скопируйте код вручную.'));}}>Скопировать код</button><small>Действует 24 часа. Передайте код лично знакомому человеку. Его заявку ещё нужно будет подтвердить.</small></div>}
        <form onSubmit={event=>{event.preventDefault();void run(()=>nearbyCall(nearby,'nearby_request',{p_code:code.trim(),p_name:displayName}),'Заявка отправлена. Дождитесь подтверждения друга.');}}>
          <label>Код от друга<input value={code} onChange={event=>setCode(event.target.value)} maxLength={32} autoComplete="off" spellCheck={false}/></label>
          <button disabled={busy||!/^[a-fA-F0-9]{32}$/.test(code.trim())||displayName.length<2||displayName.length>40}>Отправить заявку</button>
        </form>
      </section>
      {data?.directory_enabled&&<ResidentDirectory key={`directory-${city}`} client={nearby} city={city} name={displayName} publicCity={data.self.public_city??null} refresh={refresh} openRequests={()=>document.getElementById('friends-incoming')?.scrollIntoView({behavior:'smooth'})}/>}
      {pending.length>0&&<section id="friends-incoming" className="friends-card"><h2>Приглашения</h2>{pending.map(friend=><article className="friend-row" key={friend.id}><h3>{friend.name}</h3><p>{friend.incoming?'Хочет добавить вас в друзья':'Ожидает подтверждения'}</p>
        {friend.incoming?<><button disabled={busy} onClick={()=>void run(()=>nearbyCall(nearby,'nearby_respond',{p_peer:friend.id,p_accept:true}))}>Принять</button><button className="friends-secondary" disabled={busy} onClick={()=>void run(()=>nearbyCall(nearby,'nearby_respond',{p_peer:friend.id,p_accept:false}))}>Отклонить</button></>:<button className="friends-secondary" disabled={busy} onClick={()=>void run(()=>nearbyCall(nearby,'nearby_disconnect',{p_peer:friend.id,p_block:false}))}>Отменить заявку</button>}
      </article>)}</section>}
      <section className="friends-card"><div className="friends-list-heading"><h2>Мои друзья · {friends.length}</h2><button className="friends-secondary" disabled={busy} onClick={()=>void run(async()=>{})}>Обновить</button></div>
        {!data?<p>Не удалось получить список или он ещё загружается. Нажмите «Обновить».</p>:!friends.length?<p>Пока никого нет. Обменяйтесь кодами с человеком, которого знаете.</p>:friends.map(friend=><article key={friend.id} className="friend-row"><h3>{friend.name}</h3><p>{activePoint(friend,now)?`Делится приблизительной точкой до ${localTime(friend.expires_at!)}`:'Сейчас невидим'}</p>
          <button className="friends-secondary" disabled={busy} onClick={()=>void run(()=>nearbyCall(nearby,'nearby_disconnect',{p_peer:friend.id,p_block:false}))}>Удалить из друзей</button>
          <button className="friends-secondary" disabled={busy} onClick={()=>void run(()=>nearbyCall(nearby,'nearby_disconnect',{p_peer:friend.id,p_block:true}))}>Заблокировать</button>
        </article>)}
      </section>
      {!!data?.blocked.length&&<section className="friends-card"><h2>Заблокированные</h2>{data.blocked.map(person=><article className="friend-row" key={person.id}><h3>{person.name}</h3><button disabled={busy} onClick={()=>void run(()=>nearbyCall(nearby,'nearby_disconnect',{p_peer:person.id,p_block:false}))}>Разблокировать</button><small>Дружба и доступ к точке автоматически не восстанавливаются.</small></article>)}</section>}
      {import.meta.env.VITE_FRIENDS_BACKEND==='host'&&<section className="friends-card"><h2>Ваши данные</h2><p>Можно удалить имя для друзей, код, точку, список друзей и блокировки. Учётная запись на сайте останется.</p><button className="friends-secondary" disabled={busy||locating} onClick={()=>{if(window.confirm('Удалить все ваши данные раздела «Друзья рядом»? Друзей потребуется добавить заново.')){++generation.current;void run(async()=>{await nearbyCall(nearby,'nearby_forget');setName('');setCode('');},'Данные раздела удалены. Вы невидимы.');}}}>Удалить данные раздела</button></section>}
    </>}
  </div>;
}
