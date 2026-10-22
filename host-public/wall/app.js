import {verifyHuman} from '/security/antispam.js?v=20261022spam1';
import {c as createClient} from './supabase-client.js';
import {rejectWallPost,loadReviewReasons,saveWallDraft} from './moderation.js?v=20261020a';
const sb=createClient('https://cptbmepnbzogqkfhflsg.supabase.co','sb_publishable_-LLEHXpg_rqIZ_vUdPnwTQ_0ajeVm37',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});
const $=s=>document.querySelector(s);
const ui={content:$('#content'),alert:$('#flash'),tabs:$('#tabs'),session:$('#session'),city:$('#city'),adminTab:$('#adminTab')};
const s={view:['admin','write'].includes(new URLSearchParams(location.search).get('view'))?new URLSearchParams(location.search).get('view'):'feed',city:new URLSearchParams(location.search).get('city')||localStorage.getItem('ryadom.wall.city')||'Енисейск',cities:[],user:null,isOwner:false,staff:[],settings:{posts_mode:'review',comments_mode:'open'},expanded:null,adminMode:'pending',editing:null,posts:[],busy:false,draftSave:null};
const TYPES={post:'Запись жителя',question:'Вопрос жителя',news:'Новости города'};
const STATUS={draft:'Черновик',pending:'На проверке',published:'Опубликовано',rejected:'Отклонено',archived:'Скрыто'};
const PHOTO_TYPES={
 'jpg':'image/jpeg','jpeg':'image/jpeg','jpe':'image/jpeg','png':'image/png',
 'webp':'image/webp','gif':'image/gif','avif':'image/avif','bmp':'image/bmp',
 'heic':'image/heic','heif':'image/heif','tif':'image/tiff','tiff':'image/tiff'
};
const VIDEO_TYPES={'mp4':'video/mp4','webm':'video/webm','mov':'video/quicktime'};
function fileExtension(f){return String(f.name||'').split('.').pop().toLowerCase()}
function fileType(f,types){const ext=fileExtension(f);if(!types[ext])return null;
 const mime=types[ext]; if(f.type&&f.type!==mime&&f.type!=='application/octet-stream'){
  // Apple и некоторые браузеры передают image/heic как image/heif и обратно.
  if(!((ext==='heic'||ext==='heif')&&['image/heic','image/heif'].includes(f.type)))return null;
 }
 return {format:ext==='jpeg'||ext==='jpe'?'jpg':ext==='tiff'?'tif':ext,mime};
}
function makeAvatar(profile,official=false){
 const a=el('span','avatar'+(official?' official':''));
 const label=String(profile?.display_name|| (official?'РЯДОМ':'Житель')).trim();
 const initial=el('span','avatar-initial',[(official?'Р':Array.from(label)[0]||'Ж').toUpperCase()]);a.append(initial);
 if(profile?.avatar_url && /^https:\/\//i.test(profile.avatar_url)){
  const image=document.createElement('img'); image.className='profile-avatar-image';image.src=profile.avatar_url;
  image.alt='Аватар автора'; image.loading='lazy';image.referrerPolicy='no-referrer';
  image.onerror=()=>image.remove();a.append(image);
 }
 return a;
}
async function getAuthorCards(ids){
 const m=new Map(); const authors=[...new Set(ids.filter(Boolean))].slice(0,100);if(!authors.length)return m;
 try{const rows=await rpc('community_visible_author_cards',{p_ids:authors});
  for(const p of rows||[])m.set(p.author_id,p);
 }catch(e){console.warn('Авторские профили недоступны:',e?.message)}
 if(s.user&&authors.includes(s.user.id)){
  const meta=s.user.user_metadata||{},current=m.get(s.user.id)||{};
  const avatar=current.avatar_url||meta.avatar_url||meta.picture||meta.photo_url||null;
  m.set(s.user.id,{...current,display_name:current.display_name||meta.full_name||meta.name||'Вы',avatar_url:avatar});
 }
 return m;
}
const text=x=>document.createTextNode(String(x??''));
function el(tag,cls,children=[]){const n=document.createElement(tag);if(cls)n.className=cls;for(const ch of [].concat(children))if(ch!==null&&ch!==undefined)n.append(typeof ch==='string'||typeof ch==='number'?text(ch):ch);return n}
function btn(t,fn,cls='btn'){const n=el('button',cls,[t]);n.type='button';n.onclick=fn;return n}
function info(t){return el('p','muted',[t])}
function heading(t){return el('h2','',[t])}
function safeTime(t){return t?new Date(t).toLocaleString('ru-RU',{dateStyle:'medium',timeStyle:'short'}):''}
function flash(t,err=false){ui.alert.hidden=false;ui.alert.className='flash'+(err?' error':'');ui.alert.textContent=t;window.scrollTo({top:0,behavior:'smooth'})}
function hideFlash(){ui.alert.hidden=true;ui.alert.textContent=''}
function errMsg(e){const msg=String(e?.message||e||'Ошибка подключения');if(msg.includes('Too many comments'))return 'Слишком много комментариев за последний час.';if(msg.includes('Daily post limit'))return 'Лимит: до 10 предложенных записей в день.';if(msg.includes('Not authorized'))return 'Недостаточно прав для действия в этом городе.';return msg}
async function act(fn){if(s.busy)return;s.busy=true;try{await fn()}catch(e){flash(errMsg(e),true)}finally{s.busy=false}}
function authRequired(){if(s.user)return true;flash('Чтобы писать на стене, ставить лайки и комментировать, войдите в аккаунт «РЯДОМ» на главной странице.',true);return false}
function isStaff(city=s.city){return s.isOwner||s.staff.includes(city)}
async function rpc(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data}
async function auth(){const {data}=await sb.auth.getSession();s.user=data?.session?.user||null;s.isOwner=false;s.staff=[];
 if(s.user){const r=await sb.from('city_admin_access').select('city,role').eq('user_id',s.user.id).eq('active',true);if(!r.error){s.isOwner=(r.data||[]).some(x=>x.role==='owner'&&x.city==='*');s.staff=(r.data||[]).filter(x=>x.city!=='*').map(x=>x.city)}}
 ui.session.replaceChildren();if(s.user){ui.session.append(el('span','',[s.user.email||'Вы вошли в аккаунт']),text(' · '),btn('Выйти',()=>act(async()=>{await sb.auth.signOut();await auth();goto('feed')}),'btn ghost small'))}
 else {const a=el('a','',['Войти / зарегистрироваться']);a.href='/#/login';ui.session.append(a)}
 ui.adminTab.hidden=!(s.isOwner||s.staff.length);if(s.view==='admin'&&ui.adminTab.hidden)s.view='feed';
}
async function cities(){const {data,error}=await sb.from('city_directory').select('name').eq('active',true).order('name');if(error)throw error;s.cities=(data||[]).map(x=>x.name);if(!s.cities.length)throw Error('Не найдены активные города');if(!s.cities.includes(s.city))s.city=s.cities[0];ui.city.replaceChildren(...s.cities.map(x=>{const o=document.createElement('option');o.value=x;o.textContent=x;return o}));ui.city.value=s.city;}
async function settings(){const r=await sb.from('community_wall_settings').select('posts_mode,comments_mode').eq('city',s.city).maybeSingle();if(r.error)throw r.error;s.settings={posts_mode:r.data?.posts_mode||'review',comments_mode:r.data?.comments_mode||'open'};}
// Черновик хранится отдельно для каждого аккаунта, города и редактируемой записи.
const DRAFT_NS='ryadom.wall.compose.v2';
function draftKey(editId=null){
 return [DRAFT_NS,s.user?.id||'guest',encodeURIComponent(s.city),editId||'new'].join(':');
}
function readDraft(key){
 try{const raw=localStorage.getItem(key);if(!raw)return null;
  const obj=JSON.parse(raw);return obj&&typeof obj==='object'&&typeof obj.title==='string'&&typeof obj.body==='string'?obj:null;
 }catch{return null}
}
function writeDraft(key,obj){
 try{localStorage.setItem(key,JSON.stringify({...obj,savedAt:Date.now()}));return true}
 catch{return false}
}
function removeDraft(key){try{localStorage.removeItem(key)}catch{}}
// Убираем только парные маркеры Markdown; обычные * в цифрах и формулах сохраняем.
function cleanMarkdownPaste(value){
 return String(value).replace(/\r\n?/g,'\n')
  .replace(/\*\*([^*\n]+?)\*\*/g,'$1')
  .replace(/(?<![\p{L}\p{N}*])\*([^*\n]+?)\*(?![\p{L}\p{N}*])/gu,'$1')
  .replace(/(^|\n)([ \t]*)\* +(?=\S)/g,'$1$2• ');
}
function cleanPastedText(field){
 field.addEventListener('paste',event=>{
  const clip=event.clipboardData?.getData('text/plain');
  if(typeof clip!=='string')return;
  const fixed=cleanMarkdownPaste(clip);
  if(fixed===clip)return;
  event.preventDefault();
  const a=field.selectionStart??field.value.length,b=field.selectionEnd??a;
  field.setRangeText(fixed,a,b,'end');
  field.dispatchEvent(new Event('input',{bubbles:true}));
 });
}
function saveCurrentComposer(){if(typeof s.draftSave==='function')s.draftSave()}
window.addEventListener('pagehide',saveCurrentComposer);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveCurrentComposer()});
function goto(view,params={}){saveCurrentComposer();s.draftSave=null;s.view=view;s.expanded=null;s.editing=params.edit||null;hideFlash();const u=new URL(location.href);if(view==='admin')u.searchParams.set('view','admin');else if(view==='write'&&!params.edit)u.searchParams.set('view','write');else u.searchParams.delete('view');history.replaceState(null,'',u);for(const b of ui.tabs.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===view);void render().catch(e=>flash(errMsg(e),true));}
function panel(...children){return el('section','panel',children)}
function badge(v){return el('span','badge '+v,[STATUS[v]||v])}
async function render(){ui.content.replaceChildren(el('div','empty',['Загружаем…']));if(s.view==='feed')return renderFeed();if(s.view==='write')return renderComposer();if(s.view==='mine')return renderMine();if(s.view==='admin')return renderAdmin()}
async function postsQuery(moderation=false){let q=sb.from('community_posts').select('id,city,author_id,title,body,post_type,status,created_at,pinned_at');if(!moderation)q=q.eq('status','published');else if(s.adminMode==='pending')q=q.eq('status','pending');else if(s.adminMode==='published')q=q.eq('status','published');else q=q.in('status',['archived','rejected']);q=q.eq('city',s.city).order('created_at',{ascending:false}).limit(60);const r=await q;if(r.error)throw r.error;const arr=r.data||[];return moderation?arr:arr.sort((a,b)=>Number(Boolean(b.pinned_at))-Number(Boolean(a.pinned_at))||Date.parse(b.created_at)-Date.parse(a.created_at))}
async function getPhotos(postIds){const m=new Map();if(!postIds.length)return m;const {data,error}=await sb.from('community_post_photos').select('post_id,slot,object_path').in('post_id',postIds).order('slot',{ascending:true});if(error)throw error;for(const ph of data||[]){const a=m.get(ph.post_id)||[];a.push(ph);m.set(ph.post_id,a)}return m}
async function getLikes(ids){const m=new Map();if(!ids.length)return m;try{const data=await rpc('community_like_summary',{p_ids:ids.slice(0,50)});for(const item of data||[])m.set(item.post_id,item);}catch{/* Reactions are not essential to reading */}return m}
async function getVideos(postIds){const m=new Map();if(!postIds.length)return m;
 const {data,error}=await sb.from('community_post_videos').select('post_id,object_path,format').in('post_id',postIds);
 if(error)throw error;for(const v of data||[])m.set(v.post_id,v);return m;
}

// Просмотр фото по нажатию: полноэкранное окно, увеличение и перелистывание.
function openWallPhotoViewer(items,selected=0,opener=null){
 if(!items.length)return;
 const previousFocus=opener||document.activeElement;
 const overlay=el('div','wall-lightbox');
 overlay.setAttribute('role','dialog');
 overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label','Просмотр фотографий записи');
 const toolbar=el('div','wall-lightbox-toolbar');
 const stage=el('div','wall-lightbox-stage');
 const picture=document.createElement('img');
 picture.className='wall-lightbox-image';
 picture.alt='Увеличенное фото к записи';
 picture.draggable=false;
 stage.append(picture);
 const label=el('span','wall-lightbox-counter');
 let current=Math.max(0,Math.min(items.length-1,selected));
 let scale=1;
 let natural={width:0,height:0};
 const closeBtn=btn('✕ Закрыть',close,'wall-lightbox-control');
 const minusBtn=btn('−',()=>setScale(scale/1.5),'wall-lightbox-control wall-lightbox-zoom');
 minusBtn.setAttribute('aria-label','Уменьшить фото');
 const plusBtn=btn('+',()=>setScale(scale*1.5),'wall-lightbox-control wall-lightbox-zoom');
 plusBtn.setAttribute('aria-label','Увеличить фото');
 const download=el('a','wall-lightbox-control wall-lightbox-open',['Открыть оригинал ↗']);
 download.target='_blank';download.rel='noopener noreferrer';
 toolbar.append(label,minusBtn,plusBtn,download,closeBtn);
 const previous=btn('‹',()=>show(current-1),'wall-lightbox-arrow wall-lightbox-previous');
 const next=btn('›',()=>show(current+1),'wall-lightbox-arrow wall-lightbox-next');
 previous.setAttribute('aria-label','Предыдущее фото');
 next.setAttribute('aria-label','Следующее фото');
 overlay.append(toolbar,stage);
 if(items.length>1)overlay.append(previous,next);
 let originalOverflow=document.body.style.overflow;
 function close(){
  document.removeEventListener('keydown',keyHandler);
  window.removeEventListener('resize',resizeHandler);
  overlay.remove();document.body.style.overflow=originalOverflow;
  if(previousFocus?.isConnected && typeof previousFocus.focus==='function')previousFocus.focus({preventScroll:true});
 }
 function setScale(value){
  scale=Math.min(4,Math.max(1,value));
  if(!natural.width||!natural.height)return;
  const availableW=Math.max(stage.clientWidth-20,100);
  const availableH=Math.max(stage.clientHeight-20,100);
  const fit=Math.min(availableW/natural.width,availableH/natural.height,1);
  picture.style.width=Math.round(natural.width*fit*scale)+'px';
  picture.style.height=Math.round(natural.height*fit*scale)+'px';
  minusBtn.disabled=scale<=1;
  plusBtn.disabled=scale>=4;
 }
 function show(index){
  current=(index+items.length)%items.length;
  scale=1;natural={width:0,height:0};
  label.textContent='Фото '+(current+1)+' из '+items.length;
  const record=items[current];
  download.href=record.url;
  picture.alt=record.alt||'Фото к записи';
  picture.removeAttribute('src');
  picture.style.width='auto';picture.style.height='auto';
  picture.onload=()=>{
   natural={width:picture.naturalWidth,height:picture.naturalHeight};
   setScale(1);
   stage.scrollTop=0;stage.scrollLeft=0;
  };
  picture.onerror=()=>{label.textContent='Не удалось открыть фото';download.href=record.url};
  picture.src=record.url;
 }
 function keyHandler(event){
  if(event.key==='Escape'){event.preventDefault();close()}
  else if(event.key==='ArrowRight'&&items.length>1){event.preventDefault();show(current+1)}
  else if(event.key==='ArrowLeft'&&items.length>1){event.preventDefault();show(current-1)}
  else if(event.key==='+'||event.key==='='){event.preventDefault();setScale(scale*1.5)}
  else if(event.key==='-'){event.preventDefault();setScale(scale/1.5)}
 }
 function resizeHandler(){setScale(scale)}
 stage.addEventListener('click',event=>{if(event.target===stage)close()});
 picture.addEventListener('click',()=>setScale(scale===1?2:1));
 overlay.addEventListener('wheel',event=>{
  if(!event.ctrlKey)return;
  event.preventDefault();setScale(event.deltaY<0?scale*1.2:scale/1.2);
 },{passive:false});
 document.addEventListener('keydown',keyHandler);
 window.addEventListener('resize',resizeHandler);
 document.body.style.overflow='hidden';
 document.body.append(overlay);
 show(current);closeBtn.focus({preventScroll:true});
}

async function imageList(photos=[],video=null){
 if(!(photos?.length)&&!video)return null;
 const wrapper=el('div','post-media');
 if(photos?.length){
  const grid=el('div','post-photos');
  const gallery=[];
  for(const ph of photos){
   const {data,error}=await sb.storage.from('ryadom-wall-photos').createSignedUrl(ph.object_path,3600);
   if(error||!data?.signedUrl)continue;
   const url=data.signedUrl;
   const index=gallery.length;
   gallery.push({url,alt:'Фото '+(index+1)+' к записи'});
   const cell=el('div','post-media-cell');
   const open=btn('',()=>{},'post-image-button');
   open.setAttribute('aria-label','Открыть фото '+(index+1)+' в полном размере');
   open.title='Нажмите, чтобы увеличить фотографию';
   const image=document.createElement('img');
   image.src=url;image.alt='Фото '+(index+1)+' к записи';image.loading='lazy';
   image.onerror=()=>{
    open.replaceChildren();
    const fallback=el('a','media-download',['Открыть изображение']);
    fallback.href=url;fallback.target='_blank';fallback.rel='noopener noreferrer';
    cell.replaceChildren(fallback);
   };
   open.append(image);
   open.addEventListener('click',()=>openWallPhotoViewer(gallery,index,open));
   cell.append(open);grid.append(cell);
  }
  if(grid.childNodes.length)wrapper.append(grid);
 }
 if(video){
  const {data,error}=await sb.storage.from('ryadom-wall-videos').createSignedUrl(video.object_path,3600);
  if(!error&&data?.signedUrl){const box=el('div','video-wrap'),player=document.createElement('video');
   player.src=data.signedUrl;player.controls=true;player.preload='metadata';player.playsInline=true;
   player.setAttribute('controlsList','nodownload');
   const a=el('a','media-download',['Открыть или скачать видео']);a.href=data.signedUrl;a.target='_blank';a.rel='noopener noreferrer';
   box.append(player,a);wrapper.append(box);
  }
 }
 return wrapper.childNodes.length?wrapper:null;
}
// Поделиться опубликованной записью: подтверждение всегда остаётся за пользователем.
function wallPostLink(post){
 const url=new URL('/wall/',location.origin);
 url.searchParams.set('post',post.id);
 url.searchParams.set('city',post.city);
 return url.href;
}
function postShareActions(card,post){
 card.querySelector('.ryadom-share-menu')?.remove();
 const menu=el('div','ryadom-share-menu');
 menu.setAttribute('aria-label','Поделиться записью');
 const link=wallPostLink(post);
 const title=(post.title||'Запись на городской стене РЯДОМ').slice(0,160);
 const sharing=[
  ['ВКонтакте','https://vk.com/share.php?url='+encodeURIComponent(link)+'&title='+encodeURIComponent(title)],
  ['MAX','https://max.ru/:share?text='+encodeURIComponent(title+' — '+link)],
  ['Telegram','https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(title)]
 ];
 for(const [label,href] of sharing){
  const a=el('a','btn small secondary',[label]);
  a.href=href;a.target='_blank';a.rel='noopener noreferrer';
  menu.append(a);
 }
 menu.append(btn('Скопировать ссылку',async()=>{
  try{await navigator.clipboard.writeText(link);flash('Ссылка на запись скопирована.')}
  catch{const text=window.prompt('Скопируйте ссылку на запись:',link);void text}
 },'btn small ghost'));
 const actions=card.querySelector('.post-actions');if(actions)actions.after(menu);else card.append(menu);
}

function showRejectionForm(card,post){
 if(card.querySelector('.review-reason-form'))return;
 const form=el('form','review-reason-form');
 const input=document.createElement('textarea');input.id='review-reason-'+post.id;input.required=true;input.minLength=3;input.maxLength=1000;input.rows=3;
 const label=el('label','field',['Причина отказа',input]);label.htmlFor=input.id;
 const send=btn('Отклонить с причиной',()=>{});send.type='submit';
 form.append(label,el('div','btnrow',[send,btn('Отмена',()=>form.remove(),'btn secondary')]));
 form.addEventListener('submit',event=>{
  event.preventDefault();void act(async()=>{
   send.disabled=true;
   try{await rejectWallPost(sb,post.id,input.value);await renderAdmin();flash('Запись отклонена. Автор увидит причину в разделе «Мои записи».');}
   finally{send.disabled=false}
  });
 });
 card.append(form);input.focus();
}

async function makePost(post,photos=[],likes=null,scope='feed',video=null,author=null){
 const card=el('article','post'+(post.pinned_at?' notice':''));card.dataset.ryadomPostId=post.id;const head=el('div','post-head');
 const official=post.post_type==='news';
 head.append(makeAvatar(author,official),el('div','',[
  el('div','post-person',[official?'Администрация города':(author?.display_name|| (post.author_id===s.user?.id?'Ваша запись':'Житель города'))]),
  el('div','post-meta',[(TYPES[post.post_type]||'Запись')+' · '+post.city+' · '+safeTime(post.created_at)])]));if(post.pinned_at)head.append(el('span','pin',['📌 Закреплено']));card.append(head,el('h3','post-title',[post.title]),el('p','post-body',[post.body]));
 if(post.status!=='published')card.append(badge(post.status));const images=await imageList(photos,video);if(images)card.append(images);
 const actions=el('div','post-actions');
 if(scope==='feed'){
  const n=Number(likes?.like_count||0);actions.append(btn((likes?.liked?'♥':'♡')+' '+n,()=>act(async()=>{if(!authRequired())return;await rpc('toggle_community_post_like',{p_post_id:post.id});await gotoAsync('feed')}),' '+(likes?.liked?'liked':'')),btn('💬 Комментарии',()=>{s.expanded=s.expanded===post.id?null:post.id;void renderFeed() }),btn('↗ Поделиться',()=>postShareActions(card,post),'btn small secondary'));
 }
 if(scope==='mine'){
  if(post.status==='rejected'&&post.review_reason)card.append(el('p','status-note',['Причина отказа: '+post.review_reason]));
  if(['draft','rejected'].includes(post.status))actions.append(
   btn('Редактировать и добавить медиа',()=>goto('write',{edit:post}),'btn small secondary'),
   btn('Отправить',()=>act(async()=>{await verifyHuman(sb,'wall_post',post.id);await rpc('community_submit_post',{p_post_id:post.id});await renderMine();flash('Запись отправлена на модерацию.')}),'btn small')
  );
  if(post.status==='pending'){
   if(s.isOwner)actions.append(btn('Опубликовать сейчас',()=>act(async()=>{
    await rpc('review_community_post',{p_id:post.id,p_approve:true});await renderMine();flash('Запись опубликована! Её видно в ленте города.');
   }),'btn small'));
   actions.append(btn('Вернуть в черновики (для изменений)',()=>act(async()=>{
    await rpc('community_retract_pending_post',{p_id:post.id});await renderMine();flash('Запись возвращена в черновики. Теперь можно добавить фото или видео.');
   }),'btn small secondary'));
  }
  if(['draft','pending','rejected','published'].includes(post.status))actions.append(btn('Отозвать',()=>act(async()=>{if(!confirm('Скрыть эту запись со стены?'))return;await rpc('archive_community_post',{p_id:post.id});await renderMine()}),'btn small ghost'));
 }
 if(isStaff(post.city)&&scope!=='mine'){
  if(scope==='admin'&&post.status==='pending'&&(s.isOwner||post.author_id!==s.user?.id))actions.append(btn('Опубликовать',()=>act(async()=>{await rpc('review_community_post',{p_id:post.id,p_approve:true});flash('Запись опубликована.');await renderAdmin()}),'btn small'),btn('Отклонить',()=>showRejectionForm(card,post),'btn small ghost'));
  if(post.status==='published')actions.append(btn(post.pinned_at?'Открепить':'📌 Закрепить',()=>act(async()=>{await rpc('moderate_community_post',{p_post_id:post.id,p_action:post.pinned_at?'unpin':'pin'});await render()}),'btn small secondary'),btn('Скрыть',()=>act(async()=>{if(!confirm('Убрать запись из публичной ленты?'))return;await rpc('moderate_community_post',{p_post_id:post.id,p_action:'hide'});await render()}),'btn small ghost'));
 }
 // Удаление опубликованных и скрытых записей непосредственно в ленте и админке.
 // Серверная функция дополнительно проверяет активную роль глобального владельца.
 if(s.isOwner && ['feed','admin','mine'].includes(scope)){
  actions.append(btn('🗑 Удалить',()=>act(async()=>{
   const title=String(post.title||'').slice(0,90);
   if(!confirm('Удалить запись «'+title+'» навсегда?\n\nБудут удалены комментарии, лайки и вложенные фото/видео. Это действие нельзя отменить.'))return;
   const {data,error}=await sb.functions.invoke('ryadom-owner-delete-wall-post',{
    body:{post_id:post.id}
   });
   if(error){
    let detail=error.message;
    try {const reason=await error.context?.json?.();if(reason?.error)detail=reason.error}
    catch{/* Тело ошибки бывает недоступно */}
    throw Error(detail||'Ошибка удаления записи');
   }
   if(!data?.deleted)throw Error(data?.error||'Запись не была удалена');
   await render();
   flash(data.media_cleanup_errors
    ?'Запись удалена со стены. Остались вложения в хранилище: обратитесь к поддержке.'
    :'Запись и её вложения удалены со стены.');
  }),'btn small owner-delete-post'));
 }
 // Редактирование прямо на карточке. Только глобальный владелец «РЯДОМ».
 // Сервер повторно проверяет роль owner, поэтому подделка интерфейса бесполезна.
 if(s.isOwner && post.status==='published' && ['feed','admin','mine'].includes(scope)){
  actions.append(btn('✏️ Редактировать',()=>editPublishedPostInline(card,post),'btn small secondary'));
 }
 if(actions.childNodes.length)card.append(actions);
 if(scope==='feed'&&s.expanded===post.id)card.append(await commentSection(post.id));return card;
}
function editPublishedPostInline(card,post){
 if(!s.user||!s.isOwner||post.status!=='published')return;
 card.querySelector('.owner-inline-post-editor')?.remove();
 const form=el('form','owner-inline-post-editor');
 const title=document.createElement('input');title.type='text';title.required=true;
 title.minLength=5;title.maxLength=160;title.value=post.title;
 const body=document.createElement('textarea');body.required=true;
 body.minLength=10;body.maxLength=5000;body.rows=7;body.value=post.body;
 cleanPastedText(title);cleanPastedText(body);
 const buttons=el('div','btnrow');
 const save=btn('Сохранить изменения',()=>{},'btn small');save.type='submit';
 const cancel=btn('Отмена',()=>form.remove(),'btn small secondary');
 buttons.append(save,cancel);
 form.append(makeField('Заголовок',title,true),makeField('Текст записи',body,true),
  el('p','draft-help',['Редактирование доступно только владельцу платформы. Автор, город, лайки и закрепление не меняются.']),buttons);
 form.addEventListener('submit',event=>{event.preventDefault();void act(async()=>{
  save.disabled=true;
  try{
   await rpc('owner_edit_community_post',{
    p_post_id:post.id,p_title:cleanMarkdownPaste(title.value.trim()),p_body:cleanMarkdownPaste(body.value.trim())
   });
   await render();
   flash('Запись обновлена на городской стене.');
  }finally{save.disabled=false}
 })});
 card.append(form);title.focus();form.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function gotoAsync(view){s.view=view;await render()}
async function commentSection(postId){const section=el('section','comments');const {data,error}=await sb.from('community_comments').select('id,post_id,author_id,body,status,created_at').eq('post_id',postId).eq('status','published').order('created_at',{ascending:true}).limit(80);if(error)throw error;
 if(!(data||[]).length)section.append(info('Пока нет комментариев. Начните обсуждение!'));
 const authors=await getAuthorCards((data||[]).map(x=>x.author_id));
 for(const c of data||[]){const line=el('div','comment'),content=el('div','');const person=authors.get(c.author_id);
 content.append(el('div','comment-info',[person?.display_name|| (c.author_id===s.user?.id?'Вы':'Житель города'),' · ',safeTime(c.created_at)]),el('p','comment-text',[c.body]));if(isStaff(s.city))content.append(btn('Скрыть',()=>act(async()=>{if(!confirm('Скрыть комментарий?'))return;await rpc('hide_community_comment',{p_id:c.id});s.expanded=postId;await renderFeed()}),'btn ghost small'));line.append(makeAvatar(person,false),content);section.append(line)}
 const form=el('form','comment-form');const field=document.createElement('textarea');field.maxLength=2000;field.minLength=2;field.required=true;field.placeholder='Написать комментарий…';cleanPastedText(field);const send=btn('Отправить',()=>{});send.type='submit';form.append(field,send);form.addEventListener('submit',e=>{e.preventDefault();void act(async()=>{if(!authRequired())return;send.disabled=true;try{await verifyHuman(sb,'wall_comment');await rpc('submit_community_comment',{p_post_id:postId,p_body:cleanMarkdownPaste(field.value.trim())});s.expanded=postId;await renderFeed();if(s.settings.comments_mode==='review')flash('Комментарий отправлен на проверку.')}finally{send.disabled=false}})});section.append(form);return section;}
async function renderFeed(){let [posts,] = await Promise.all([postsQuery(),settings()]);
 const requested=new URLSearchParams(location.search).get('post');
 if(requested && /^[0-9a-f-]{36}$/i.test(requested) && !posts.some(p=>p.id===requested)){
  const {data:linkedPost}=await sb.from('community_posts').select('id,city,author_id,title,body,post_type,status,created_at,pinned_at').eq('id',requested).eq('city',s.city).eq('status','published').maybeSingle();
  if(linkedPost)posts=[linkedPost,...posts];
 }
 s.posts=posts;const ids=posts.map(x=>x.id),[photos,likes,videos,authors]=await Promise.all([
 getPhotos(ids),getLikes(ids),getVideos(ids),getAuthorCards(posts.map(x=>x.author_id))
 ]);ui.content.replaceChildren();if(!posts.length){ui.content.append(el('div','empty',[heading('Пока нет записей'),info('Предложите первую запись для жителей '+s.city+'.'),btn('Предложить запись',()=>goto('write'))]));return}
 for(const p of posts)ui.content.append(await makePost(p,photos.get(p.id),likes.get(p.id),'feed',videos.get(p.id),authors.get(p.author_id)));
 const requestedPost=new URLSearchParams(location.search).get('post');
 if(requestedPost && /^[0-9a-f-]{36}$/i.test(requestedPost)){
  const element=[...ui.content.querySelectorAll('[data-ryadom-post-id]')].find(node=>node.dataset.ryadomPostId===requestedPost);
  if(element){element.classList.add('ryadom-post-shared-target');requestAnimationFrame(()=>element.scrollIntoView({block:'start',behavior:'smooth'}))}
 }
}
function makeField(label,node,full=false){return el('label','field'+(full?' full':''),[label,node])}
async function renderComposer(edit=null){if(!s.user){ui.content.replaceChildren(panel(heading('Предложить запись'),info('Для публикации нужно войти в аккаунт «РЯДОМ». По ссылке откроется форма входа на основном сайте.'),el('a','btn',['Войти на сайт'])));ui.content.querySelector('a').href='/#/login';return}
 await settings();const existing=edit||s.editing;const section=panel(heading(existing?'Изменить запись':'Предложить запись'));section.append(el('div','status-note',['Новые записи сначала попадут на модерацию. После одобрения их увидят все жители города.']));
 const form=el('form','form-grid');const typ=document.createElement('select');[['post','Обычная запись'],['question','Вопрос жителям']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;typ.append(o)});typ.value=existing?.post_type||'post';typ.disabled=!!existing;
 const title=document.createElement('input');title.required=true;title.minLength=5;title.maxLength=160;title.placeholder='Например: Подскажите, где найти…';title.value=existing?.title||'';
 const body=document.createElement('textarea');body.required=true;body.minLength=10;body.maxLength=5000;body.placeholder='Напишите свой вопрос, новость или предложение для соседей…';body.value=existing?.body||'';
 const files=document.createElement('input');files.type='file';files.accept='image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/heic,image/heif,image/tiff,.heic,.heif,.tif,.tiff';files.multiple=true;
 const videoInput=document.createElement('input');videoInput.type='file';videoInput.accept='video/mp4,video/webm,video/quicktime,.mov,.mp4,.webm';
 form.append(makeField('Тип записи',typ),makeField('Заголовок',title),makeField('Текст записи',body,true),
  makeField('Фотографии (до 4, JPEG, PNG, WebP, GIF, AVIF, BMP, HEIC/HEIF, TIFF, до 10 МБ)',files,true),
  makeField('Видео (MP4, WebM, MOV, до 50 МБ, одно на запись)',videoInput,true));
 const mediaHelp=el('p','draft-help field full',['Некоторые форматы фото iPhone и видео MOV могут не воспроизводиться в чужом браузере. Их можно будет скачать. SVG не принимаются по соображениям безопасности.']);form.append(mediaHelp);
 // Сохраняем текст после каждого изменения, чтобы не потерять его при смене вкладки,
 // обновлении страницы, повторной авторизации или переходе в другой браузер и обратно.
 const key=draftKey(existing?.id);
 const cached=readDraft(key);
 if(cached){
  if(!existing || (cached.savedAt && cached.savedAt>Date.parse(existing.updated_at||existing.created_at||0))){
   if(['post','question'].includes(cached.type)&&!existing)typ.value=cached.type;
   title.value=cached.title.slice(0,160);
   body.value=cached.body.slice(0,5000);
  }
 }
 const saveStatus=el('div','draft-status',[cached?'Восстановлен сохранённый черновик. Текст сохраняется автоматически.':'Текст сохраняется автоматически в этом браузере.']);
 const save=()=>{
  if(!form.isConnected)return;
  const state={type:typ.value,title:title.value,body:body.value};
  const okay=writeDraft(key,state);
  saveStatus.textContent=okay?'Черновик сохранён на этом устройстве.':'Не удалось сохранить черновик. Проверьте настройки браузера.';
 };
 for(const field of [typ,title,body]){
  field.addEventListener('input',save);
  if(field!==typ)cleanPastedText(field);
 }
 s.draftSave=save;
 form.append(el('div','field full',[saveStatus,
  btn('Очистить черновик',()=>{
   if(!confirm('Удалить сохранённый черновик этой записи?'))return;
   removeDraft(key);title.value='';body.value='';if(!existing)typ.value='post';
   saveStatus.textContent='Черновик удалён. Можно начать заново.';
  },'btn ghost small')
 ]));
 if(!existing)form.append(el('p','draft-help field full',[
  'Текст сохранится при выходе со страницы и после обновления. Фотографии нужно выбрать повторно. При вставке текста символы **жирного** и *курсива* автоматически убираются.'
 ]));
 let savedPostId=existing?.id||null;const uploadedPhotos=new Set();let uploadedVideo=null;
 const buttons=el('div','btnrow');const submit=btn(existing?'Сохранить изменения':'Отправить запись',()=>{});submit.type='submit';buttons.append(submit,btn('Отмена',()=>goto(existing?'mine':'feed'),'btn secondary'));form.append(el('div','field full',[buttons]));form.addEventListener('submit',ev=>{ev.preventDefault();void act(async()=>{
  if(!authRequired())return;submit.disabled=true;
  try{
   const uploads=[...files.files],videoFile=videoInput.files?.[0]||null;
   if(uploads.length>4)throw Error('К одной записи можно прикрепить не более четырёх фотографий.');
   const photos=uploads.filter(f=>!uploadedPhotos.has(f)).map(f=>({f,type:fileType(f,PHOTO_TYPES)}));
   for(const item of photos){if(!item.type)throw Error('Неподдерживаемый формат фотографии: '+item.f.name);
    if(item.f.size>10485760)throw Error('Фотография превышает 10 МБ: '+item.f.name);}
   const videoType=videoFile?fileType(videoFile,VIDEO_TYPES):null;
   if(videoFile&&(!videoType||videoFile.size>52428800))throw Error('Видео должно быть MP4, WebM или MOV размером до 50 МБ.');
   if(!existing)await verifyHuman(sb,'wall_post',savedPostId);
   let postId;
   if(savedPostId){await saveWallDraft(sb,savedPostId,s.user.id,cleanMarkdownPaste(title.value.trim()),cleanMarkdownPaste(body.value.trim()));postId=savedPostId;
   }else{postId=await rpc('create_community_post',{p_city:s.city,p_type:typ.value,p_title:cleanMarkdownPaste(title.value.trim()),p_body:cleanMarkdownPaste(body.value.trim())});savedPostId=postId;}
   if(photos.length){const current=await getPhotos([postId]);const taken=new Set((current.get(postId)||[]).map(p=>p.slot));
    const free=[0,1,2,3].filter(x=>!taken.has(x));
    if(photos.length>free.length)throw Error('В записи можно хранить до четырёх фотографий. Уже добавлено: '+taken.size);
    for(let i=0;i<photos.length;i++){
     const {f,type}=photos[i],recordId=crypto.randomUUID();
     const {data:ph,error}=await sb.from('community_post_photos').insert({id:recordId,post_id:postId,slot:free[i],format:type.format}).select('object_path').single();if(error)throw error;
     const put=await sb.storage.from('ryadom-wall-photos').upload(ph.object_path,f,{contentType:type.mime,upsert:false});
     if(put.error){await sb.from('community_post_photos').delete().eq('id',recordId);throw put.error;}uploadedPhotos.add(f);
    }
   }
   if(videoFile&&uploadedVideo!==videoFile){const current=await getVideos([postId]);if(current.has(postId))throw Error('У записи уже есть видео. Второе добавить нельзя.');
    const recordId=crypto.randomUUID();
    const {data:v,error}=await sb.from('community_post_videos').insert({id:recordId,post_id:postId,format:videoType.format}).select('object_path').single();if(error)throw error;
    const put=await sb.storage.from('ryadom-wall-videos').upload(v.object_path,videoFile,{contentType:videoType.mime,upsert:false});
    if(put.error){await sb.from('community_post_videos').delete().eq('id',recordId);throw put.error;}uploadedVideo=videoFile;
   }
   removeDraft(key);s.draftSave=null;
   if(existing){goto('mine');flash('Запись и вложения сохранены. Теперь нажмите «Отправить» в разделе «Мои записи».');}
   else {await rpc('community_submit_post',{p_post_id:postId});goto('mine');flash('Запись отправлена на модерацию.');}
  }finally{submit.disabled=false}
 })});section.append(form);ui.content.replaceChildren(section)}
async function renderMine(){if(!s.user){ui.content.replaceChildren(panel(heading('Мои записи'),info('Войдите на основном сайте, чтобы видеть предложенные записи.')));return}
 const {data,error}=await sb.from('community_posts').select('id,city,author_id,title,body,post_type,status,created_at,pinned_at').eq('author_id',s.user.id).eq('city',s.city).order('created_at',{ascending:false}).limit(60);if(error)throw error;const posts=data||[];const reasons=await loadReviewReasons(sb,posts);for(const post of posts)post.review_reason=reasons.get(post.id);const [photos,videos,authors]=await Promise.all([
 getPhotos(posts.map(p=>p.id)),getVideos(posts.map(p=>p.id)),getAuthorCards(posts.map(p=>p.author_id))
 ]);ui.content.replaceChildren();ui.content.append(panel(heading('Мои записи'),info('Здесь отображаются черновики, предложенные и опубликованные записи.')));if(!posts.length)ui.content.append(el('div','empty',[info('Вы ещё ничего не публиковали.'),btn('Создать запись',()=>goto('write'))]));for(const p of posts)ui.content.append(await makePost(p,photos.get(p.id),null,'mine',videos.get(p.id),authors.get(p.author_id)));}
async function renderAdmin(){if(!isStaff()){goto('feed');return}await settings();ui.content.replaceChildren();const top=panel(heading('Управление стеной · '+s.city),info('Предложенные записи и комментарии жителей. Настройки действуют только в этом городе.'));
 const form=el('form','admin-grid');const postsMode=document.createElement('select'),commentsMode=document.createElement('select');[['review','Через модерацию']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;postsMode.append(o)});[['open','Комментарии сразу'],['review','Комментарии после проверки']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;commentsMode.append(o)});postsMode.value='review';postsMode.disabled=true;commentsMode.value=s.settings.comments_mode;
 form.append(makeField('Публикация записей',postsMode),makeField('Комментарии',commentsMode));form.append(el('div','field full',[btn('Сохранить настройки',()=>act(async()=>{await rpc('set_community_wall_settings',{p_city:s.city,p_posts_mode:postsMode.value,p_comments_mode:commentsMode.value});await settings();flash('Настройки стены сохранены для города '+s.city+'.')}),'btn small')]));top.append(form);
 const news=el('details','');const summary=el('summary','',['Опубликовать новость от администрации']);summary.style.cursor='pointer';news.append(summary);const newsForm=el('form','form-grid');const ntitle=document.createElement('input'),nbody=document.createElement('textarea');ntitle.placeholder='Заголовок новости';ntitle.maxLength=160;ntitle.minLength=5;ntitle.required=true;nbody.placeholder='Текст новости…';nbody.minLength=10;nbody.maxLength=5000;nbody.required=true;cleanPastedText(ntitle);cleanPastedText(nbody);const nbutton=btn('Опубликовать новость',()=>{});nbutton.type='submit';newsForm.append(makeField('Заголовок',ntitle,true),makeField('Текст',nbody,true),el('div','field full',[nbutton]));newsForm.onsubmit=e=>{e.preventDefault();void act(async()=>{await rpc('publish_city_news',{p_city:s.city,p_title:cleanMarkdownPaste(ntitle.value.trim()),p_body:cleanMarkdownPaste(nbody.value.trim())});flash('Новость опубликована.');await renderAdmin()})};news.append(newsForm);top.append(el('hr','sep'),news);ui.content.append(top);
 const modes=el('nav','subtabs');for(const [v,label] of [['pending','Предложенные'],['published','Опубликованные'],['hidden','Скрытые']])modes.append(btn(label,()=>{s.adminMode=v;void renderAdmin()},s.adminMode===v?'selected':''));ui.content.append(modes);
 const posts=await postsQuery(true);
 const [photos,videos,authors]=await Promise.all([
  getPhotos(posts.map(p=>p.id)),getVideos(posts.map(p=>p.id)),getAuthorCards(posts.map(p=>p.author_id))
 ]);if(!posts.length)ui.content.append(el('div','empty',[heading('Записей в этой очереди нет')]));for(const p of posts)ui.content.append(await makePost(p,photos.get(p.id),null,'admin',videos.get(p.id),authors.get(p.author_id)));
 const {data:comments,error}=await sb.from('community_comments').select('id,post_id,author_id,body,status,created_at,community_posts!inner(city,title)').eq('status','pending').eq('community_posts.city',s.city).order('created_at',{ascending:true}).limit(50);if(!error&&comments?.length){ui.content.append(heading('Комментарии на проверке'));for(const c of comments){const row=panel(el('div','post-person',[c.community_posts?.title||'Комментарий']),el('p','post-body',[c.body]));row.append(el('div','btnrow',[btn('Разрешить',()=>act(async()=>{await rpc('review_community_comment',{p_id:c.id,p_approve:true});await renderAdmin()}),'btn small'),btn('Отклонить',()=>act(async()=>{await rpc('review_community_comment',{p_id:c.id,p_approve:false});await renderAdmin()}),'btn ghost small')]));ui.content.append(row)}}
}
async function boot(){try{await cities();await auth();await settings();ui.city.addEventListener('change',async()=>{s.city=ui.city.value;localStorage.setItem('ryadom.wall.city',s.city);s.expanded=null;await settings();goto('feed')});ui.tabs.addEventListener('click',e=>{const v=e.target.closest('[data-view]')?.dataset.view;if(v)goto(v)});sb.auth.onAuthStateChange((event,session)=>{if(event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION'||(event==='SIGNED_IN'&&session?.user?.id===s.user?.id))return;setTimeout(()=>{saveCurrentComposer();void auth().then(()=>render()).catch(e=>flash(errMsg(e),true))},0)});if(s.view==='admin'&&!isStaff())s.view='feed';for(const b of ui.tabs.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===s.view);await render()}catch(e){ui.content.replaceChildren(el('div','empty',['Не удалось загрузить стену.']));flash(errMsg(e),true)}}
boot();
