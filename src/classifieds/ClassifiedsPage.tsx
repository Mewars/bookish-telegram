import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  createDraft,dealLabels,getBlockedClassifiedUsers,getConversations,getMessages,getOlderMessages,getMine,getOpenClassifiedReports,getPending,
  getClassifiedUnreadCounts,markClassifiedMessagesRead,
  getPublished,markComplete,archiveClassified,mayReview,moderate,openConversation,reviewClassifiedReport,sendMessage,setClassifiedUserBlock,
  submitForReview,updateClassifiedDraft,validateDraft,CLASSIFIED_MESSAGE_PAGE_SIZE,
} from './repository';
import type { ChatMessage,Classified,ClassifiedReport,Conversation,DealType,Draft } from './repository';
import { ClassifiedReportControl } from './ClassifiedReportControl';
import { ClassifiedPhotoGallery } from './ClassifiedPhotoGallery';
import { classifiedsSessionKey } from './sessionKey';
import { visibleClassifiedListings } from './listFilters';
import { hasNewUnreadMessages,INBOX_REFRESH_INTERVAL_MS } from './inboxRefresh';
import './classifieds.css';

type Tab='browse'|'mine'|'messages'|'moderate'|'reports';
const deals:DealType[]=['sell','buy','rent_out','rent_in'];
function priceLabel(value:number|null):string {
  return value===null?'Цена договорная':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value)+' ₽';
}
function newDraft(city:string):Draft {
  return {city,title:'',description:'',category:'',deal_type:'sell',district:'',price_rub:null};
}
function errorText(reason:unknown):string {
  return reason instanceof Error?reason.message:'Не удалось выполнить действие. Попробуйте ещё раз.';
}

export function ClassifiedsPage({city,openLogin}:{city:string;openLogin:()=>void}) {
  const {state}=useAuth();
  const userId=state.status==='authenticated'?state.user.id:null;
  return <ClassifiedsSession key={classifiedsSessionKey(city,userId)} city={city} openLogin={openLogin} userId={userId}/>;
}

function ClassifiedsSession({city,openLogin,userId}:{city:string;openLogin:()=>void;userId:string|null}) {
  const [tab,setTab]=useState<Tab>('browse');
  const [deal,setDeal]=useState<DealType|null>(null);
  const [search,setSearch]=useState('');
  const [items,setItems]=useState<Classified[]>([]);
  const [threads,setThreads]=useState<Conversation[]>([]);
  const [unreadCounts,setUnreadCounts]=useState<Record<string,number>>({});
  const unreadCountsRef=useRef<Record<string,number>>({});
  const [newUnreadNotice,setNewUnreadNotice]=useState(false);
  const [reports,setReports]=useState<ClassifiedReport[]>([]);
  const [blockedUsers,setBlockedUsers]=useState<string[]>([]);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [threadId,setThreadId]=useState<string|null>(null);
  const [messageDraft,setMessageDraft]=useState('');
  const [composer,setComposer]=useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [rejectingId,setRejectingId]=useState<string|null>(null);
  const [rejectionDraft,setRejectionDraft]=useState('');
  const [draft,setDraft]=useState<Draft>(()=>newDraft(city));
  const [reload,setReload]=useState(0);
  const [busy,setBusy]=useState(false);
  const [loadedView,setLoadedView]=useState('');
  const [loadFailedKey,setLoadFailedKey]=useState('');
  const [messagesFor,setMessagesFor]=useState<string|null>(null);
  const [messageLoadedKey,setMessageLoadedKey]=useState('');
  const [messageFailedKey,setMessageFailedKey]=useState('');
  const [hasOlderMessages,setHasOlderMessages]=useState(false);
  const [olderMessagesBusy,setOlderMessagesBusy]=useState(false);
  const [olderMessagesError,setOlderMessagesError]=useState('');
  const historyGeneration=useRef(0);
  const [notice,setNotice]=useState('');
  const [canReview,setCanReview]=useState(false);
  useEffect(()=>{
    let active=true;
    const permission=userId?mayReview(supabase,city):Promise.resolve(false);
    permission.then(value=>{if(active)setCanReview(value);})
      .catch(()=>{if(active)setCanReview(false);});
    return ()=>{active=false;};
  },[city,userId]);
  const viewKey=[tab,city,userId??'',canReview,reload].join('|');
  const loading=loadedView!==viewKey;
  useEffect(()=>{unreadCountsRef.current=unreadCounts;},[unreadCounts]);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      if(tab==='browse') {
        const result=await getPublished(supabase,city);
        if(active)setItems(result);
      } else if(tab==='mine') {
        if(!userId){if(active)setItems([]);return;}
        const result=await getMine(supabase,userId,city);
        if(active)setItems(result);
      } else if(tab==='moderate') {
        if(!canReview){if(active)setItems([]);return;}
        const result=await getPending(supabase,city);
        if(active)setItems(result);
      } else if(tab==='reports') {
        if(!canReview){if(active)setReports([]);return;}
        const result=await getOpenClassifiedReports(supabase,city);
        if(active)setReports(result);
      } else if(tab==='messages') {
        if(!userId){if(active)setThreads([]);return;}
        const [result,blocks,unread]=await Promise.all([
          getConversations(supabase,userId),getBlockedClassifiedUsers(supabase,userId),
          getClassifiedUnreadCounts(supabase),
        ]);
        if(active){setThreads(result);setBlockedUsers(blocks);setUnreadCounts(unread);}
      }
    };
    void load().then(()=>{if(active)setLoadFailedKey('');})
      .catch(reason=>{
        if(!active)return;
        setLoadFailedKey(viewKey);
        setNotice(errorText(reason));
        // Never show rows from a previous tab as if they belonged to this one.
        setItems([]);setReports([]);setThreads([]);setUnreadCounts({});
      })
      .finally(()=>{if(active)setLoadedView(viewKey);});
    return ()=>{active=false;};
  },[city,userId,tab,canReview,reload,viewKey]);
  // In-app inbox hint only while the private inbox is open and visible.
  // No browser notification permission or background tracking is requested.
  useEffect(()=>{
    if(tab!=='messages'||!userId||loading||loadFailedKey===viewKey)return;
    let active=true;
    let querying=false;
    const refreshUnread=async()=>{
      if(document.visibilityState!=='visible'||querying)return;
      querying=true;
      try {
        const counts=await getClassifiedUnreadCounts(supabase);
        if(active){
          if(hasNewUnreadMessages(unreadCountsRef.current,counts))setNewUnreadNotice(true);
          unreadCountsRef.current=counts;
          setUnreadCounts(counts);
        }
      } catch {
        // Keep the last known counts rather than inventing zero unread messages.
      } finally {
        querying=false;
      }
    };
    const interval=window.setInterval(()=>{void refreshUnread();},INBOX_REFRESH_INTERVAL_MS);
    const onVisibility=()=>{if(document.visibilityState==='visible')void refreshUnread();};
    document.addEventListener('visibilitychange',onVisibility);
    return ()=>{
      active=false;window.clearInterval(interval);
      document.removeEventListener('visibilitychange',onVisibility);
    };
  },[tab,userId,loading,loadFailedKey,viewKey]);
  useEffect(()=>{
    let active=true;
    const generation=++historyGeneration.current;
    if(!threadId||tab!=='messages')return ()=>{active=false;};
    const requestKey=JSON.stringify([threadId,reload]);
    void getMessages(supabase,threadId)
      .then(rows=>{
        if(active&&historyGeneration.current===generation){
          setMessages(rows);setMessagesFor(threadId);setMessageFailedKey('');
          setHasOlderMessages(rows.length===CLASSIFIED_MESSAGE_PAGE_SIZE);
          setOlderMessagesBusy(false);setOlderMessagesError('');
          const latest=rows[rows.length-1];
          if(latest&&userId) {
            // Mark only the last message actually loaded into this visible chat.
            // A new message arriving concurrently is not automatically marked read.
            void markClassifiedMessagesRead(supabase,threadId,latest.id)
              .then(()=>getClassifiedUnreadCounts(supabase))
              .then(counts=>{
                if(active&&historyGeneration.current===generation)setUnreadCounts(counts);
              })
              .catch(reason=>{
                if(active&&historyGeneration.current===generation)setNotice(errorText(reason));
              });
          }
        }
      })
      .catch(reason=>{
        if(active&&historyGeneration.current===generation){
          setMessages([]);setMessagesFor(null);setMessageFailedKey(requestKey);
          setHasOlderMessages(false);setOlderMessagesBusy(false);setOlderMessagesError('');
          setNotice(errorText(reason));
        }
      })
      .finally(()=>{
        if(active&&historyGeneration.current===generation)setMessageLoadedKey(requestKey);
      });
    return ()=>{active=false;};
  },[threadId,reload,tab,userId]);
  const loadOlderMessages=()=>{
    if(!threadId||olderMessagesBusy||messageLoading||messageLoadFailed||
        !hasOlderMessages||messagesFor!==threadId||messages.length===0)return;
    const oldest=messages[0];
    const generation=historyGeneration.current;
    setOlderMessagesBusy(true);setOlderMessagesError('');
    void getOlderMessages(supabase,threadId,oldest)
      .then(older=>{
        if(historyGeneration.current!==generation)return;
        setMessages(current=>{
          if(current[0]?.id!==oldest.id)return current;
          const knownIds=new Set(current.map(message=>message.id));
          return [...older.filter(message=>!knownIds.has(message.id)),...current];
        });
        setHasOlderMessages(older.length===CLASSIFIED_MESSAGE_PAGE_SIZE);
      })
      .catch(reason=>{
        if(historyGeneration.current===generation)setOlderMessagesError(errorText(reason));
      })
      .finally(()=>{
        if(historyGeneration.current===generation)setOlderMessagesBusy(false);
      });
  };
  const execute=async(action:()=>Promise<void>,after?:()=>void)=>{
    if(busy)return;
    setBusy(true);setNotice('');
    try{await action();setReload(value=>value+1);after?.();}
    catch(reason){setNotice(errorText(reason));}
    finally{setBusy(false);}
  };
  const startChat=(entry:Classified)=>{
    if(!userId){openLogin();return;}
    void execute(async()=>{
      const id=await openConversation(supabase,entry.id);
      setThreadId(id);
      setTab('messages');
    });
  };
  const startNewDraft=()=>{
    setComposer(value=>!value);setEditingId(null);setDraft(newDraft(city));setNotice('');
  };
  const editListing=(entry:Classified)=>{
    if(!userId||entry.author_id!==userId||!['draft','rejected'].includes(entry.status))return;
    setEditingId(entry.id);
    setDraft({
      city:entry.city,title:entry.title,description:entry.description,
      category:entry.category,deal_type:entry.deal_type,district:entry.district,
      price_rub:entry.price_rub,
    });
    setComposer(true);setNotice('');
  };
  const filtered=visibleClassifiedListings(items,tab==='browse'?'browse':tab==='moderate'?'moderate':'mine',deal,search);
  const activeThread=loading||loadFailedKey===viewKey?undefined:threads.find(x=>x.id===threadId);
  const otherParticipant=activeThread ? activeThread.buyer_id===userId?activeThread.seller_id:activeThread.buyer_id : null;
  const isBlocked=otherParticipant ? blockedUsers.includes(otherParticipant) : false;
  const messageRequestKey=JSON.stringify([threadId,reload]);
  const messageLoading=Boolean(threadId)&&messageLoadedKey!==messageRequestKey;
  const messageLoadFailed=Boolean(threadId)&&messageFailedKey===messageRequestKey;
  const currentMessages=messagesFor===threadId&&!messageLoading&&!messageLoadFailed?messages:[];
  return <section className="classifieds-page">
    <header className="classifieds-hero">
      <span className="classifieds-eyebrow">РЯДОМ · ТЕСТОВАЯ ВЕРСИЯ</span>
      <h1>Объявления — {city}</h1>
      <p>Покупайте, продавайте, сдавайте и снимайте. Переписывайтесь прямо в «РЯДОМ».</p>
      <div className="classifieds-tabs" role="group" aria-label="Разделы объявлений">
        <button aria-pressed={tab==='browse'} onClick={()=>setTab('browse')}>Объявления</button>
        <button aria-pressed={tab==='mine'} onClick={()=>userId?setTab('mine'):openLogin()}>Мои объявления</button>
        <button aria-pressed={tab==='messages'} onClick={()=>userId?setTab('messages'):openLogin()}>Сообщения</button>
        {canReview&&<button aria-pressed={tab==='moderate'} onClick={()=>setTab('moderate')}>На проверке</button>}
        {canReview&&<button aria-pressed={tab==='reports'} onClick={()=>setTab('reports')}>Жалобы</button>}
      </div>
    </header>
    {notice&&<p className="classifieds-feedback" role="status">{notice}</p>}
    {tab==='browse'&&<div className="classifieds-filter">
      <label>Найти объявление
        <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Что ищете?"/>
      </label>
      <div className="classifieds-deals" role="group" aria-label="Вид объявления">
        <button aria-pressed={deal===null} onClick={()=>setDeal(null)}>Все</button>
        {deals.map(value=><button key={value} aria-pressed={deal===value} onClick={()=>setDeal(value)}>{dealLabels[value]}</button>)}
      </div>
    </div>}
    {tab==='mine'&&userId&&<div className="classifieds-my-actions">
      <div><h2>Ваши объявления</h2><p>Сначала сохраняйте черновик, затем отправляйте его на проверку.</p></div>
      <button className="classifieds-main-action" onClick={startNewDraft} aria-expanded={composer}>
        {composer?'Закрыть форму':'+ Подать объявление'}
      </button>
    </div>}
    {tab==='mine'&&composer&&userId&&<form className="classifieds-form" onSubmit={e=>{
      e.preventDefault();
      const error=validateDraft(draft);
      if(error){setNotice(error);return;}
      const wasEditing=Boolean(editingId);
      const save=editingId
        ?()=>updateClassifiedDraft(supabase,editingId,userId,draft)
        :()=>createDraft(supabase,draft);
      void execute(save,()=>{
        setComposer(false);setEditingId(null);setDraft(newDraft(city));
        setNotice(wasEditing?'Исправления сохранены. Теперь отправьте объявление на проверку.':'Черновик сохранён. Теперь его можно отправить на проверку.');
      });
    }}>
      <h3>{editingId?'Редактирование объявления':'Новое объявление'}</h3>
      <div className="classifieds-form-grid">
        <label>Что хотите сделать?
          <select value={draft.deal_type} onChange={e=>setDraft(d=>({...d,deal_type:e.target.value as DealType}))}>
            {deals.map(value=><option key={value} value={value}>{dealLabels[value]}</option>)}
          </select>
        </label>
        <label>Категория
          <input required maxLength={80} value={draft.category} onChange={e=>setDraft(d=>({...d,category:e.target.value}))} placeholder="Например, мебель"/>
        </label>
        <label className="classifieds-full">Заголовок
          <input required minLength={5} maxLength={140} value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} placeholder="Что продаёте или ищете?"/>
        </label>
        <label>Район (необязательно)
          <input maxLength={100} value={draft.district} onChange={e=>setDraft(d=>({...d,district:e.target.value}))} placeholder="Без точного домашнего адреса"/>
        </label>
        <label>Цена в рублях (можно не указывать)
          <input type="number" min="0" max="999999999.99" step="0.01"
            value={draft.price_rub??''} onChange={e=>setDraft(d=>({...d,price_rub:e.target.value===''?null:Number(e.target.value)}))}/>
        </label>
        <label className="classifieds-full">Описание
          <textarea required minLength={15} maxLength={4000} rows={5} value={draft.description}
            onChange={e=>setDraft(d=>({...d,description:e.target.value}))} placeholder="Состояние товара, условия сделки, другая полезная информация"/>
        </label>
      </div>
      <p className="classifieds-note">После сохранения черновика можно добавить до 10 фотографий. Контактный телефон и точный адрес не публикуются автоматически.</p>
      <button className="classifieds-main-action" disabled={busy} type="submit">{editingId?'Сохранить исправления':'Сохранить черновик'}</button>
    </form>}
    {(tab==='browse'||tab==='mine'||tab==='moderate')&&
      (loading?<p className="classifieds-empty" role="status">Загружаем объявления…</p>:
       loadFailedKey===viewKey?<div className="classifieds-empty" role="alert">
          <h2>Не удалось загрузить объявления</h2>
          <p>Повторите запрос. Старые данные других разделов скрыты.</p>
          <button onClick={()=>setReload(value=>value+1)}>Повторить загрузку</button>
        </div>:filtered.length===0?<div className="classifieds-empty">
          <h2>{tab==='moderate'?'Нет объявлений на проверке':'Объявлений пока нет'}</h2>
          <p>{tab==='browse'?'Здесь появятся объявления жителей после проверки. Вымышленные карточки не добавляем.':
               tab==='mine'?'Нажмите «Подать объявление», чтобы сохранить первый черновик.':'Все заявки на текущий момент обработаны.'}</p>
        </div>:<div className="classifieds-grid">{filtered.map(entry=>
        <article className="classifieds-card" key={entry.id}>
          <div className="classifieds-card-meta"><span>{dealLabels[entry.deal_type]}</span><span>{entry.category}</span></div>
          <ClassifiedPhotoGallery listing={entry} editable={tab==='mine' && entry.author_id===userId && (entry.status==='draft' || entry.status==='rejected')}/>
          <h2>{entry.title}</h2>
          <p>{entry.description}</p>
          <div className="classifieds-card-foot">
            <strong>{priceLabel(entry.price_rub)}</strong>
            <small>{entry.district||entry.city}</small>
          </div>
          {tab==='browse'&&entry.status==='published'&&entry.author_id!==userId&&
            <button className="classifieds-card-button" disabled={busy} onClick={()=>startChat(entry)}>Написать автору</button>}
          {tab==='browse'&&entry.status==='published'&&entry.author_id!==userId&&
            <ClassifiedReportControl listingId={entry.id} userId={userId} openLogin={openLogin}/>}
          {tab==='browse'&&entry.status==='completed'&&<small>Сделка завершена</small>}
          {tab==='mine'&&<div className="classifieds-card-actions">
            <small>Статус: {({draft:'Черновик',pending:'На проверке',published:'Опубликовано',rejected:'Отклонено',archived:'В архиве',completed:'Завершено'} as Record<string,string>)[entry.status]}</small>
            {entry.status==='rejected'&&entry.rejection_reason&&<p className="classifieds-rejection-reason" role="note"><strong>Причина отклонения:</strong> {entry.rejection_reason}</p>}
            {['draft','rejected'].includes(entry.status)&&<button disabled={busy} onClick={()=>editListing(entry)}>Изменить</button>}
            {['draft','rejected'].includes(entry.status)&&<button disabled={busy} onClick={()=>void execute(()=>submitForReview(supabase,entry.id,userId!))}>Отправить на проверку</button>}
            {entry.status==='published'&&<button disabled={busy} onClick={()=>void execute(()=>markComplete(supabase,entry.id))}>Продано / сдано</button>}
            {['published','completed'].includes(entry.status)&&<button disabled={busy} onClick={()=>{
              if(!window.confirm('Снять объявление с публикации? Вернуть его через интерфейс пока нельзя. Новые сообщения по объявлению будут недоступны.'))return;
              void execute(()=>archiveClassified(supabase,entry.id),()=>setNotice('Объявление снято с публикации.'));
            }}>Снять с публикации</button>}
          </div>}
          {tab==='moderate'&&entry.author_id!==userId&&<div className="classifieds-card-actions">
            <button disabled={busy} onClick={()=>void execute(()=>moderate(supabase,entry.id,true))}>Опубликовать</button>
            <button disabled={busy} aria-expanded={rejectingId===entry.id}
              onClick={()=>{setRejectingId(rejectingId===entry.id?null:entry.id);setRejectionDraft('');}}>
              Отклонить
            </button>
            {rejectingId===entry.id&&<div className="classifieds-rejection-editor">
              <label htmlFor={`classified-reason-${entry.id}`}>Причина отклонения (10–500 символов)</label>
              <textarea id={`classified-reason-${entry.id}`} rows={3} maxLength={500}
                value={rejectionDraft} onChange={event=>setRejectionDraft(event.target.value)}
                placeholder="Объясните автору, что нужно исправить"/>
              <div className="classifieds-card-actions">
                <button disabled={busy||rejectionDraft.trim().length<10}
                  onClick={()=>void execute(()=>moderate(supabase,entry.id,false,rejectionDraft),()=>{
                    setRejectingId(null);setRejectionDraft('');
                  })}>Подтвердить отклонение</button>
                <button disabled={busy} onClick={()=>{setRejectingId(null);setRejectionDraft('');}}>Отмена</button>
              </div>
            </div>}
          </div>}
        </article>)}</div>)}
    {tab==='reports'&&<section className="classifieds-reports">
      <h2>Жалобы жителей · {city}</h2>
      {loading?<p role="status">Загружаем жалобы…</p>:
       loadFailedKey===viewKey?<div role="alert"><p>Не удалось загрузить жалобы.</p>
         <button onClick={()=>setReload(value=>value+1)}>Повторить загрузку</button>
       </div>:reports.length===0?<p>Новых жалоб нет.</p>:
        reports.map(report=><article className="classifieds-report-card" key={report.id}>
          <h3>{report.classifieds.title}</h3><p>{report.reason}</p>
          <small>{new Date(report.created_at).toLocaleString('ru-RU')}</small>
          <div className="classifieds-card-actions">
            <button disabled={busy} onClick={()=>void execute(()=>reviewClassifiedReport(supabase,report.id,false))}>Жалобу отклонить</button>
            <button disabled={busy} onClick={()=>void execute(()=>reviewClassifiedReport(supabase,report.id,true))}>Скрыть объявление</button>
          </div>
        </article>)}
    </section>}
    {tab==='messages'&&newUnreadNotice&&<div className="classifieds-inbox-notice" role="status">
      <span>Появились новые сообщения.</span>
      <button type="button" onClick={()=>{
        setNewUnreadNotice(false);setReload(value=>value+1);
      }}>Обновить переписки</button>
    </div>}
    {tab==='messages'&&<div className="classifieds-messages">
      <aside className="classifieds-thread-list">
        <h2>Переписки</h2>
        {loading?<p>Загружаем…</p>:
         loadFailedKey===viewKey?<div role="alert"><p>Не удалось загрузить переписки.</p>
           <button onClick={()=>setReload(value=>value+1)}>Повторить загрузку</button>
         </div>:threads.length===0?<p>Пока нет переписок. Откройте объявление и нажмите «Написать автору».</p>:
        threads.map(entry=><button key={entry.id} aria-pressed={threadId===entry.id}
          onClick={()=>{setThreadId(entry.id);setMessageDraft('');}}>
          <strong>{entry.buyer_id===userId?'Диалог с автором':'Диалог с покупателем'}</strong>
          <small>Объявление · {entry.listing_id.slice(0,8)}</small>
          {unreadCounts[entry.id]>0&&<span className="classifieds-unread-count"
            aria-label={`Непрочитанных сообщений: ${unreadCounts[entry.id]}`}>
            {unreadCounts[entry.id]>99?'99+':unreadCounts[entry.id]}
          </span>}
        </button>)}
      </aside>
      <section className="classifieds-chat" aria-label="Чат по объявлению">
        {activeThread?<><h2>Личная переписка</h2>
          <p className="classifieds-note">Сообщения видны только двум участникам.</p>
          {otherParticipant&&userId&&<div className="classifieds-chat-block">
            {isBlocked&&<p role="status">Вы заблокировали этого собеседника. Отправка сообщений отключена.</p>}
            <button type="button" disabled={busy} onClick={()=>void execute(
              ()=>setClassifiedUserBlock(supabase,userId,otherParticipant,!isBlocked)
            )}>{isBlocked?'Разблокировать собеседника':'Заблокировать собеседника'}</button>
          </div>}
          <div className="classifieds-chat-stream" aria-live="polite">
            {messageLoading?<p role="status">Загружаем сообщения…</p>
              :messageLoadFailed?<p role="alert">Не удалось загрузить сообщения. Попробуйте обновить переписку.</p>
              :currentMessages.length===0?<p>Напишите первое сообщение.</p>
              :currentMessages.map(m=>
                <div className={m.sender_id===userId?'classifieds-message self':'classifieds-message'} key={m.id}>
                  <span>{m.body}</span><small>{new Date(m.created_at).toLocaleString('ru-RU')}</small>
                </div>)}
          </div>
          {!messageLoading&&!messageLoadFailed&&hasOlderMessages&&currentMessages.length>0&&
            <div className="classifieds-chat-history">
              <button type="button" className="classifieds-refresh" disabled={olderMessagesBusy}
                onClick={loadOlderMessages}>
                {olderMessagesBusy?'Загружаем предыдущие сообщения…':'Показать предыдущие сообщения'}
              </button>
              {olderMessagesError&&<p role="alert">{olderMessagesError}</p>}
            </div>}
          <form className="classifieds-chat-compose" onSubmit={e=>{
            e.preventDefault();const text=messageDraft;
            void execute(()=>sendMessage(supabase,activeThread.id,text),()=>setMessageDraft(''));
          }}>
            <label htmlFor="classifieds-message-body" className="sr-only">Сообщение</label>
            <textarea id="classifieds-message-body" rows={2} maxLength={2000} value={messageDraft}
              onChange={e=>setMessageDraft(e.target.value)} placeholder="Написать сообщение…"/>
            <button className="classifieds-main-action" type="submit" disabled={busy||isBlocked||messageLoading||messageLoadFailed||!messageDraft.trim()}>Отправить</button>
          </form>
          <button className="classifieds-refresh" onClick={()=>{setNewUnreadNotice(false);setReload(v=>v+1);}}>Обновить сообщения</button>
        </>:<p>Выберите диалог слева или начните новую переписку из объявления.</p>}
      </section>
    </div>}
  </section>;
}
