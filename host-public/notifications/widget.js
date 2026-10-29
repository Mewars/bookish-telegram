import {c as createClient} from '/wall/supabase-client.js';
const supabase=createClient('https://cptbmepnbzogqkfhflsg.supabase.co','sb_publishable_-LLEHXpg_rqIZ_vUdPnwTQ_0ajeVm37',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});
const link='/notifications/';
const state={user:null,items:[],readIds:new Set(),timer:null,lastUid:null,seenReady:false,previousIds:new Set()};
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n};
const validPath=path=>typeof path==='string'&&path.startsWith('/')&&!path.startsWith('//')?path:'/';
function supportsPush(){return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol==='https:'}
function addAdminShortcut(){
 const admin=document.querySelector('section.admin-panel');
 if(!admin||admin.querySelector('[data-ryadom-notification-admin]'))return;
 const a=el('a','','🔔 Рассылка уведомлений');a.href='/notifications/';
 a.setAttribute('data-ryadom-notification-admin','1');
 Object.assign(a.style,{display:'inline-flex',margin:'8px',padding:'11px 15px',background:'#ffd166',color:'#071622',fontWeight:'700',borderRadius:'12px',textDecoration:'none'});
 admin.prepend(a);
}
function listenForAdmin(){
 if(!document.getElementById('root'))return;
 let pending=false;
 const observer=new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;addAdminShortcut()})}});
 observer.observe(document.getElementById('root'),{childList:true,subtree:true});addAdminShortcut();
}
function makeOverlayMusicSafe(){
  if(!document.getElementById('root'))return;
  document.addEventListener('click',event=>{
    const a=event.target instanceof Element?event.target.closest('a[href]'):null;
    if(!a||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||a.target==='_blank'||a.hasAttribute('download'))return;
    const url=new URL(a.href,location.href);
    if(url.origin!==location.origin||url.pathname.replace(/\/+$/,'')!=='/donate')return;
    event.preventDefault();openDonate(url.pathname+url.search);
  },true);
}
function openDonate(path){
 if(document.getElementById('ryadom-donate-overlay'))return;
 const overlay=el('div','ryadom-donate-overlay');overlay.id='ryadom-donate-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Раздел Поддержать');
 const toolbar=el('div','ryadom-donate-overlay-bar');const back=el('button','','← Вернуться на сайт');back.type='button';toolbar.append(back);
 const iframe=el('iframe','');iframe.src=path;iframe.title='РЯДОМ — Поддержать';
 const oldOverflow=document.body.style.overflow;
 function close(){overlay.remove();document.body.style.overflow=oldOverflow;document.removeEventListener('keydown',escape);back.focus()}
 function escape(e){if(e.key==='Escape'){e.preventDefault();close()}}
 back.addEventListener('click',close);document.addEventListener('keydown',escape);
 iframe.addEventListener('load',()=>{try{const doc=iframe.contentDocument;doc?.querySelectorAll('a[href="/"],a[href="/#/home"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();close()}));}catch{}});
 toolbar.setAttribute('aria-label','Управление разделом');overlay.append(toolbar,iframe);
 document.body.append(overlay);document.body.style.overflow='hidden';back.focus();
}
function addStyles(){
 const style=el('style');style.textContent=`
 .ryadom-notif-trigger{position:fixed;right:17px;bottom:94px;z-index:20000;border:1px solid #547284;background:#102c3a;color:#fff8e9;border-radius:999px;padding:10px 14px;font:700 14px system-ui;box-shadow:0 8px 30px #0006;cursor:pointer}
 .ryadom-notif-trigger:focus-visible,.ryadom-notif-popover button:focus-visible{outline:3px solid #ffd166}
 .ryadom-notif-count{display:inline-flex;border-radius:20px;background:#ffd166;color:#071622;min-width:20px;padding:1px 5px;font-size:11px;justify-content:center;margin-left:3px}
 .ryadom-notif-popover{position:fixed;right:14px;bottom:152px;width:min(380px,calc(100vw - 28px));max-height:min(72vh,550px);overflow:auto;background:#102b39;color:#fff8e9;border:1px solid #416578;border-radius:15px;padding:16px;z-index:20001;box-shadow:0 12px 48px #000b;font:14px/1.5 system-ui}
 .ryadom-notif-popover h2{font-size:19px;margin:0 0 10px}.ryadom-notif-popover a{color:#ffd166}.ryadom-notif-popover button{background:#ffd166;border:0;border-radius:10px;padding:8px 11px;cursor:pointer;font-weight:700}
 .ryadom-notif-popover article{padding:10px 0;border-bottom:1px solid #335367}.ryadom-notif-popover article p{margin:5px 0}
 .ryadom-notif-popover .ryadom-notif-muted{color:#afc8d6}.ryadom-notif-popover .ryadom-unread strong{color:#ffd166}
 .ryadom-donate-overlay{position:fixed;inset:0;z-index:99999;background:#071622;display:flex;flex-direction:column}
 .ryadom-donate-overlay-bar{min-height:48px;padding:6px 12px;background:#09202c;border-bottom:1px solid #315467;display:flex;align-items:center}
 .ryadom-donate-overlay-bar button{padding:8px 16px;border-radius:10px;color:#081d29;background:#ffd166;border:none;font:700 14px system-ui;cursor:pointer}
 .ryadom-donate-overlay iframe{border:0;width:100%;min-height:0;flex:1;background:#071622}
 .ryadom-notif-count[hidden]{display:none!important}
 .ryadom-site-toast{position:fixed;z-index:2147480000;right:17px;bottom:100px;max-width:min(370px,calc(100vw - 34px));background:#16394a;color:#fff8e9;border:1px solid #ffd166;border-radius:16px;padding:16px;box-shadow:0 12px 48px #000a;font:14px/1.5 system-ui}
 .ryadom-site-toast strong{display:block;margin-bottom:5px;font-size:17px}.ryadom-site-toast p{margin:0 0 12px}.ryadom-site-toast .buttons{display:flex;gap:8px}.ryadom-site-toast a,.ryadom-site-toast button{font:700 13px system-ui;padding:9px 11px;border:1px solid #b9985a;border-radius:10px;color:#ffd166;background:#133346;text-decoration:none;cursor:pointer}
 @media(max-width:899px){.ryadom-site-toast{bottom:100px}}

 @media(min-width:900px){.ryadom-notif-trigger{bottom:22px}.ryadom-notif-popover{bottom:79px}}
 `;document.head.append(style);
}
function notifyOnPage(item){
 if(document.hidden)return;
 document.querySelector('.ryadom-site-toast')?.remove();
 const toast=el('aside','ryadom-site-toast');toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
 toast.append(el('strong','','🔔 '+item.title),el('p','',item.body));
 const buttons=el('div','buttons');
 const link=el('a','','Открыть');link.href=validPath(item.target_path);link.addEventListener('click',()=>void setRead(item));
 const dismiss=el('button','','Закрыть');dismiss.type='button';dismiss.onclick=()=>toast.remove();
 buttons.append(link,dismiss);toast.append(buttons);document.body.append(toast);
 setTimeout(()=>toast.remove(),12000);
}

const countNode=el('span','ryadom-notif-count');
const button=el('button','ryadom-notif-trigger','🔔');button.type='button';button.title='Уведомления РЯДОМ';button.setAttribute('aria-label','Уведомления РЯДОМ');
const pop=el('section','ryadom-notif-popover');pop.hidden=true;pop.setAttribute('aria-label','Уведомления');pop.setAttribute('role','region');
button.addEventListener('click',()=>{pop.hidden=!pop.hidden;if(!pop.hidden)void renderPop();});
async function refresh(){
 if(!state.user)return;
 try{
  const {data:items,error}=await supabase.from('ryadom_site_notifications').select('id,title,body,target_path,city,created_at').order('created_at',{ascending:false}).limit(30);
  if(error)throw error;
  const list=items||[];
  if(state.seenReady){const incoming=list.find(x=>!state.previousIds.has(x.id));if(incoming)notifyOnPage(incoming)}
  state.items=list;state.previousIds=new Set(list.map(x=>x.id));state.seenReady=true;
  const ids=state.items.map(x=>x.id);
  const {data:reads}=ids.length?await supabase.from('ryadom_notification_reads').select('notification_id').eq('user_id',state.user.id).in('notification_id',ids):{data:[]};
  state.readIds=new Set((reads||[]).map(r=>r.notification_id));
  const unread=state.items.filter(x=>!state.readIds.has(x.id)).length;
  countNode.textContent=unread>99?'99+':String(unread);countNode.hidden=!unread;
  if(!pop.hidden)void renderPop();
 }catch(e){console.warn('Notifications unavailable:',e?.message||e)}
}
async function setRead(notification){
 if(!state.user)return;
 await supabase.from('ryadom_notification_reads').upsert({user_id:state.user.id,notification_id:notification.id},{onConflict:'user_id,notification_id',ignoreDuplicates:true});
 state.readIds.add(notification.id);
 void refresh();
}
async function renderPop(){
 pop.replaceChildren(el('h2','','Уведомления'));
 if(!state.user){pop.append(el('p','ryadom-notif-muted','Войдите в аккаунт, чтобы получать городские уведомления.'));return}
 const top=el('p','ryadom-notif-muted','Здесь появляются новости и сообщения вашего города.');pop.append(top);
 for(const item of state.items.slice(0,8)){
  const article=el('article',state.readIds.has(item.id)?'':'ryadom-unread');
  article.append(el('strong','',item.title),el('p','',item.body));
  const a=el('a','','Перейти');a.href=validPath(item.target_path);a.style.marginLeft='7px';a.addEventListener('click',()=>void setRead(item));article.append(a);pop.append(article);
 }
 if(!state.items.length)pop.append(el('p','ryadom-notif-muted','Пока нет уведомлений.'));
 const settings=el('p');const url=el('a','','Настройки и все уведомления →');url.href=link;settings.append(url);pop.append(settings);
 if(supportsPush()&&Notification.permission==='default'){
  const prompt=el('p','ryadom-notif-muted','Хотите получать уведомления на телефон?');pop.append(prompt);
  const enable=el('button','','Включить push');enable.addEventListener('click',()=>location.assign('/notifications/#push'));pop.append(enable);
 }
}
async function session(){
 const {data}=await supabase.auth.getUser();const u=data?.user||null;
 if((u?.id||null)!==state.lastUid){
  state.lastUid=u?.id||null;state.user=u;state.items=[];state.readIds.clear();state.seenReady=false;state.previousIds.clear();pop.hidden=true;
  if(u){void refresh();clearInterval(state.timer);state.timer=setInterval(()=>{if(!document.hidden)void refresh()},45000)}
  else{clearInterval(state.timer);state.timer=null;countNode.hidden=true}
 }
}
addStyles();makeOverlayMusicSafe();listenForAdmin();
button.append(countNode);countNode.hidden=true;
document.body.append(button,pop);
void session();
supabase.auth.onAuthStateChange(()=>{setTimeout(()=>void session(),100)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void session()});
