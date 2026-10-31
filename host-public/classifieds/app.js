import {verifyHuman} from '/security/antispam.js?v=20261022spam2';
import {MESSAGE_PAGE_SIZE,readChatMessages} from './messages.js?v=20261025chat1';
import {readCityPins,sortPinnedClassifieds} from './pins.js?v=20261021pins1';
import {createPhotoPlaceholder} from '/catalog/photoFallback.js?v=20261021catalog1';
import { c as createClient } from './supabase-client.js';
import { saveOwnedDraft, submitOwnedDraft } from './drafts.js?v=20261020a';
// The publishable key is deliberately public (never use a service-role/secret key in a browser).
// Must match the production project's client so the main site's session can be reused.
const PROJECT = 'https://cptbmepnbzogqkfhflsg.supabase.co';
const PUBLISHABLE = 'sb_publishable_-LLEHXpg_rqIZ_vUdPnwTQ_0ajeVm37';
const sb = createClient(PROJECT, PUBLISHABLE, {
  auth: {persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}
});
const BUCKET='ryadom-classified-photos';
const CATEGORIES=['Транспорт','Недвижимость','Электроника','Для дома','Одежда','Одежда и обувь','Работа','Подработка','Резюме','Услуги','Ремонт и строительство','Инструменты и оборудование','Детские товары','Животные','Сад и огород','Спорт и отдых','Хобби и коллекции','Подарки и обмен','Бюро находок','Помощь и волонтёрство','Поездки и попутчики','Продукты и урожай','Другое'];
// Все коды разрешены ограничением classifieds_deal_type_check в Supabase.
const DEAL_TYPES={
 sell:'Продам', buy:'Куплю',exchange:'Обменяю',give_away:'Отдам даром',accept_free:'Приму в дар',
 rent_out:'Сдам в аренду',rent_in:'Сниму в аренду',
 vacancy:'Предлагаю работу (вакансия)',job_seek:'Ищу работу',resume:'Размещу резюме',
 gig_offer:'Предлагаю подработку',gig_seek:'Ищу подработку',
 service_offer:'Окажу услугу',service_seek:'Ищу исполнителя / услугу',
 lost:'Потерял(а)',found:'Нашёл(ла)',
 help_offer:'Предлагаю помощь',help_seek:'Нужна помощь',
 ride_share:'Ищу попутчика',pet_give:'Отдам питомца в добрые руки',pet_seek:'Ищу питомца',
 other:'Другое предложение / запрос'
};
const FREE_TYPES=new Set(['give_away','accept_free','pet_give']);
const REWARD_TYPES=new Set(['lost','found','help_offer','help_seek']);
const EARNING_TYPES=new Set(['vacancy','job_seek','resume','gig_offer','gig_seek','service_offer','service_seek']);
const CATEGORY_BY_TYPE={vacancy:'Работа',job_seek:'Работа',resume:'Резюме',gig_offer:'Подработка',gig_seek:'Подработка',service_offer:'Услуги',service_seek:'Услуги',lost:'Бюро находок',found:'Бюро находок',help_offer:'Помощь и волонтёрство',help_seek:'Помощь и волонтёрство',ride_share:'Поездки и попутчики',pet_give:'Животные',pet_seek:'Животные',give_away:'Подарки и обмен',accept_free:'Подарки и обмен',exchange:'Подарки и обмен'};
function listingPrice(price,type){
 if(FREE_TYPES.has(type))return 'Бесплатно';
 if(type==='exchange')return price==null?'Обмен':'Обмен · '+currency(price);
 if(price==null){if(type==='resume'||type==='job_seek'||type==='gig_seek')return 'Оплата обсуждается';if(EARNING_TYPES.has(type))return 'По договорённости';if(type==='lost'||type==='found')return 'Без вознаграждения';if(type==='ride_share')return 'Условия поездки — в описании';return 'По договорённости'}
 return currency(price);
}
function contactLabel(type){return ['vacancy','job_seek','resume','gig_offer','gig_seek'].includes(type)?'Откликнуться': 'Написать автору'};

const STATUSES={draft:'Черновик',pending:'На проверке',published:'Опубликовано',rejected:'Отклонено',archived:'В архиве',completed:'Завершено'};
const $=(sel)=>document.querySelector(sel);
const ui={content:$('#content'),alert:$('#alert'),session:$('#session'),city:$('#city'),tabs:$('#tabs'),mod:$('#mod-tab')};
const initialParams=new URLSearchParams(location.search);
const state={haltura:initialParams.get('mode')==='haltura',typeFilter:initialParams.get('type')||'',view:new URLSearchParams(location.search).get('ad')?'detail':['moderation','new','mine','inbox','chat'].includes(new URLSearchParams(location.search).get('view'))?new URLSearchParams(location.search).get('view'):'feed',city:new URLSearchParams(location.search).get('city')||localStorage.getItem('ryadom.classified.city')||'Енисейск',cities:[],moderationCity:sessionStorage.getItem('ryadom.classified.moderation.city')||'',user:null,session:null,adminCities:[],isOwner:false,activeAd:/^[0-9a-f-]{36}$/i.test(new URLSearchParams(location.search).get('ad')||'')?new URLSearchParams(location.search).get('ad'):null,chat:initialParams.get('chat'),editing:null,filter:initialParams.get('q')||'',loading:false};
const txt=(x)=>document.createTextNode(String(x??''));
function elem(tag,cls,children=[]){const e=document.createElement(tag);if(cls)e.className=cls;for(const child of [].concat(children)){if(child==null)continue;e.append(typeof child==='string'||typeof child==='number'?txt(child):child)}return e}
function btn(name,onClick,cls='btn'){const el=elem('button',cls,[name]);el.type='button';el.addEventListener('click',onClick);return el}
function h2(name){return elem('h2','',[name])}
function note(name){return elem('p','muted',[name])}
function pad(node){ui.content.replaceChildren(node)}
function show(msg,error=false){ui.alert.hidden=false;ui.alert.className='alert'+(error?' error':'');ui.alert.textContent=msg;window.scrollTo({top:0,behavior:'smooth'})}
function clearAlert(){ui.alert.hidden=true;ui.alert.textContent=''}
function errorText(err){const m=String(err?.message||err||'Произошла ошибка');if(m.includes('Not authorized to review this listing'))return 'Нет права одобрить это объявление: редактор не может одобрить своё объявление. Владелец платформы имеет отдельное право.';if(m.includes('permission denied')||m.includes('row-level security')||m.includes('42501'))return 'Недостаточно прав для операции. Попробуйте обновить вход.';return m}
function requireAuth(){if(state.user)return true;show('Для этого действия войдите в аккаунт «РЯДОМ» на главном сайте. Затем вернитесь к объявлениям.',true);return false}
function currency(price){return price===null||price===undefined?'По договорённости':Number(price).toLocaleString('ru-RU')+' ₽'}
function datetime(value){try{return new Date(value).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'})}catch{return ''}}
function allowedModerationCities(){return state.isOwner?['*',...state.cities]:state.cities.filter(x=>state.adminCities.includes(x))}
async function loadCities(){const {data,error}=await sb.from('city_directory').select('name').eq('active',true).order('name',{ascending:true});if(error)throw error;state.cities=(data||[]).map(row=>row.name).filter(Boolean);if(!state.cities.length)throw new Error('Нет доступных городов.');ui.city.replaceChildren();for(const city of state.cities){const option=document.createElement('option');option.value=city;option.textContent=city;ui.city.append(option)}if(!state.cities.includes(state.city))state.city=state.cities[0];ui.city.value=state.city;}
let chatTimer=null;
function stopChatTimer(){if(chatTimer){clearInterval(chatTimer);chatTimer=null}}
function syncUrl(replace=false){const url=new URL(location.href);for(const k of ['ad','view','chat','mode','q','type'])url.searchParams.delete(k);url.searchParams.set('city',state.city);if(state.haltura)url.searchParams.set('mode','haltura');if(state.activeAd)url.searchParams.set('ad',state.activeAd);else if(state.view!=='feed')url.searchParams.set('view',state.view);if(state.chat)url.searchParams.set('chat',state.chat);if(state.filter)url.searchParams.set('q',state.filter);if(state.typeFilter)url.searchParams.set('type',state.typeFilter);if(url.href!==location.href)history[replace?'replaceState':'pushState'](null,'',url);window.dispatchEvent(new Event('ryadom:route-change'));}
function goto(view,params={}){stopChatTimer();state.view=view;state.activeAd=params.ad||null;state.chat=params.chat||null;state.editing=params.edit||null;syncUrl();clearAlert();ui.tabs.querySelectorAll('button[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));render().catch(e=>{pad(note('Не удалось открыть раздел.'));show(errorText(e),true)});}
function updateHaltura(){document.body.classList.toggle('haltura-mode',state.haltura);const intro=document.querySelector('.intro');intro.querySelector('h1').textContent=state.haltura?'Халтура рядом':'Объявления рядом';intro.querySelector('p:last-child').textContent=state.haltura?'Разовые задания и помощь жителей вашего города. Найдите подработку или того, кто поможет.':'Покупайте, продавайте и договаривайтесь напрямую с жителями города.';document.title=(state.haltura?'Халтура':'Объявления')+' — РЯДОМ';const submit=ui.tabs.querySelector('[data-view="new"]');submit.textContent=state.haltura?'Предложить задание':'Подать объявление';document.querySelector('[data-haltura]').setAttribute('aria-pressed',String(state.haltura));}
window.addEventListener('popstate',()=>{const q=new URLSearchParams(location.search);state.haltura=q.get('mode')==='haltura';state.city=state.cities.includes(q.get('city'))?q.get('city'):state.city;ui.city.value=state.city;state.activeAd=q.get('ad');state.chat=q.get('chat');state.view=state.activeAd?'detail':(['new','mine','inbox','chat','moderation'].includes(q.get('view'))?q.get('view'):'feed');state.filter=q.get('q')||'';state.typeFilter=q.get('type')||'';updateHaltura();void render();});
function loadMark(){pad(elem('p','muted',['Загружаем…']))}
async function authRefresh(){
 const {data,error}=await sb.auth.getSession();
 state.session=error?null:data.session;
 state.user=state.session?.user||null;
 state.adminCities=[];
 state.isOwner=false;
 if(state.user){
  const {data:access,error:err}=await sb.from('city_admin_access').select('city,role,active').eq('user_id',state.user.id).eq('active',true);
  if(!err){state.isOwner=(access||[]).some(x=>x.city==='*'&&x.role==='owner');state.adminCities=(access||[]).filter(x=>x.city!=='*').map(x=>x.city)}
 }
 ui.session.replaceChildren();
 if(state.user){
  ui.session.append(elem('span','',[state.user.email||'Вы вошли в аккаунт']),btn('Выйти',async()=>{await sb.auth.signOut();await authRefresh();goto('feed')},'btn secondary small'));
 }else{
  const a=elem('a','',['Войти / зарегистрироваться']);a.href='/#/login';ui.session.append(a)
 }
 ui.mod.hidden=!(state.isOwner||state.adminCities.length>0);
}
async function fetchPhotos(ids){if(!ids.length)return new Map();const {data,error}=await sb.from('classified_photos').select('id,listing_id,slot,object_path').in('listing_id',ids).order('slot',{ascending:true});if(error)throw error;const photos=new Map();for(const p of data||[]){const arr=photos.get(p.listing_id)||[];arr.push(p);photos.set(p.listing_id,arr)}return photos}
async function photoUrl(path){try{const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(path,3600);if(error)return null;return data?.signedUrl||null}catch{return null}}
async function cover(node,p){
 node.replaceChildren();
 node.setAttribute('aria-label','Загрузка фотографии');
 if(!p){node.removeAttribute('aria-label');node.append(createPhotoPlaceholder());return;}
 const src=await photoUrl(p.object_path);if(!node.isConnected)return;if(!src){node.removeAttribute('aria-label');node.append(createPhotoPlaceholder());return;}
 const img=document.createElement('img');img.className='card-img';img.loading='lazy';img.alt='Фотография объявления';
 img.onerror=()=>{const fallback=elem('div','card-img');fallback.append(createPhotoPlaceholder());img.replaceWith(fallback)};
 img.src=src;node.replaceWith(img);
}
let listingPins=new Map(),pinningAvailable=false;
function labelStatus(status){return elem('span','status '+status,[STATUSES[status]||status])}
function card(ad, photos,scope){const wrap=elem('article','card');const main=elem('button','card-link');main.type='button';main.onclick=()=>goto('detail',{ad:ad.id});const visual=elem('div','card-img');main.append(visual);void cover(visual,photos?.[0]);const body=elem('div','card-main');if(listingPins.has(ad.id)&&ad.status==='published')body.append(elem('span','listing-pin-badge',['📌 Закреплено']));body.append(h2(ad.title),elem('div','price',[listingPrice(ad.price_rub,ad.deal_type)]),elem('p','card-meta',[(DEAL_TYPES[ad.deal_type]||'Объявление')+' · '+ad.city]),labelStatus(ad.status));main.append(body);wrap.append(main);
 if(scope==='feed'&&state.isOwner&&pinningAvailable&&ad.status==='published'){
  const pinned=listingPins.has(ad.id);
  const control=btn(pinned?'📌 Открепить':'📌 Закрепить',()=>act(async()=>{
   control.disabled=true;
   try{await rpc('owner_pin_classified',{p_id:ad.id,p_pin:!pinned});await render();}
   finally{control.disabled=false;}
  }),'btn small secondary');
  control.setAttribute('aria-label',(pinned?'Открепить объявление: ':'Закрепить объявление: ')+ad.title);
  control.setAttribute('aria-pressed',String(pinned));wrap.append(elem('div','card-actions',[control]));
 }
 if(scope==='mine'){
 if(ad.status==='rejected'&&ad.rejection_reason)body.append(elem('p','card-rejection-reason',['Причина отклонения: '+ad.rejection_reason]));
 const actions=elem('div','card-actions');if(ad.status==='published')actions.append(btn('Снять и изменить',()=>act(async()=>{if(!window.confirm('Снять объявление в черновик для правок и повторной проверки?'))return;await rpc('begin_classified_revision',{p_listing_id:ad.id});goto('new',{edit:ad.id})}),'btn small secondary'));if(['draft','rejected'].includes(ad.status))actions.append(btn('Редактировать',()=>goto('new',{edit:ad.id}),'btn small secondary'));if(['published','completed'].includes(ad.status))actions.append(btn('В архив',()=>act(async()=>{await rpc('archive_classified',{p_listing_id:ad.id});goto('mine')}),'btn small secondary'));if(ad.status==='published')actions.append(btn('Завершено',()=>act(async()=>{await rpc('complete_classified',{p_listing_id:ad.id});goto('mine')}),'btn small'));if(actions.childNodes.length)wrap.append(actions)}
 if(scope==='feed'&&ad.status==='published'&&ad.author_id!==state.user?.id){
  const actions=elem('div','card-actions');
  const contact=btn(contactLabel(ad.deal_type),()=>void contactSeller(ad,contact),'btn small contact');
  actions.append(contact);wrap.append(actions)
 }
 return wrap}
async function contactSeller(ad, control){
 if(!requireAuth())return;
 if(ad.author_id===state.user.id){goto('inbox');return}
 if(ad.status!=='published'){show('Связаться с автором можно только по опубликованному объявлению.',true);return}
 if(control)control.disabled=true;
 try{
  const conversationId=await rpc('open_classified_conversation',{p_listing_id:ad.id});
  goto('chat',{chat:conversationId});
 }catch(e){show(errorText(e),true)}
 finally{if(control)control.disabled=false}
}
async function rpc(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data}
async function act(fn){try{await fn()}catch(e){show(errorText(e),true)}}
function listingGrid(items,scope){const grid=elem('div','grid');for(const ad of items)grid.append(card(ad,null,scope));return grid}
async function hydrateCardPhotos(grid,items){
 try{const photos=await fetchPhotos(items.map(x=>x.id));if(!grid.isConnected)return;
  for(const [index,ad] of items.entries()){const node=grid.children[index]?.querySelector('.card-img');if(node)void cover(node,photos.get(ad.id)?.[0]);}
 }catch{/* A photo failure must not hide listings or disable their actions. */}
}
async function gridCards(items,scope){const grid=listingGrid(items,scope);pad(grid);void hydrateCardPhotos(grid,items)}
function empty(title,explain){const x=elem('div','empty',[h2(title),note(explain)]);return x}
async function feed(){loadMark();const pinResult=await readCityPins(sb,state.city);listingPins=pinResult.pins;pinningAvailable=pinResult.available;let query=sb.from('classifieds').select('id,city,title,deal_type,category,description,district,price_rub,status,created_at,author_id').eq('city',state.city).in('status',['published','completed']);if(state.haltura)query=query.in('deal_type',['gig_offer','gig_seek']);const {data,error}=await query.order('created_at',{ascending:false}).limit(100);if(error)throw error;
const feedRows=[...(data||[])];
const missing=[...listingPins.keys()].filter(id=>!feedRows.some(row=>row.id===id));
for(let offset=0;offset<missing.length;offset+=100){
 const {data:extra,error:failed}=await sb.from('classifieds').select('id,city,title,deal_type,category,description,district,price_rub,status,created_at,author_id').in('id',missing.slice(offset,offset+100)).eq('city',state.city).eq('status','published');
 if(failed)throw failed;feedRows.push(...(extra||[]));
}
const ordered=sortPinnedClassifieds(state.haltura?feedRows.filter(x=>['gig_offer','gig_seek'].includes(x.deal_type)):feedRows,listingPins);
const pane=elem('div','panel');const search=elem('input');search.placeholder=state.haltura?'Какую подработку ищете?':'Поиск по объявлениям';search.value=state.filter;search.setAttribute('aria-label','Поиск по объявлениям');search.addEventListener('input',()=>{state.filter=search.value;syncUrl(true);void draw()});const filter=elem('select','type-filter');filter.setAttribute('aria-label','Фильтр по типу объявления');
for(const [value,label] of [['',state.haltura?'Задания и исполнители':'Все типы объявлений'],...Object.entries(DEAL_TYPES).filter(([type])=>!state.haltura||['gig_offer','gig_seek'].includes(type))]){const opt=elem('option','',[label]);opt.value=value;filter.append(opt)}
filter.value=state.typeFilter;filter.addEventListener('change',()=>{state.typeFilter=filter.value;syncUrl(true);void draw();});
const filters=elem('div','listing-search-controls',[search,filter]);if(state.haltura){const actions=elem('div','haltura-actions',[btn('Нужна помощь',()=>{state.typeFilter='';goto('new')},'btn'),btn('Ищу подработку',()=>{state.typeFilter='gig_offer';syncUrl(true);filter.value='gig_offer';void draw()},'btn secondary')]);pane.append(elem('p','overline',['ЗАДАНИЯ · ПОМОЩЬ · ПОДРАБОТКА']),h2('Задания твоего города'),note('Задания — после проверки. Отклики — в личных сообщениях.'),actions);}pane.append(filters);const list=elem('div');pad(elem('div','',[pane,list]));async function draw(){const q=state.filter.trim().toLocaleLowerCase('ru');const rows=ordered.filter(v=>(!filter.value||v.deal_type===filter.value)&&(!q||[v.title,v.description,v.category,v.district,DEAL_TYPES[v.deal_type]].some(x=>String(x||'').toLocaleLowerCase('ru').includes(q))));if(!rows.length){list.replaceChildren(empty(state.haltura?'Пока нет заданий': 'Пока нет объявлений',state.haltura?'Предложите первое задание. После проверки оно появится здесь и в объявлениях — одной карточкой.':'Станьте первым, кто опубликует объявление в этом городе.'));return}const gallery=listingGrid(rows,'feed');list.replaceChildren(gallery);void hydrateCardPhotos(gallery,rows)}await draw()}
async function mine(){if(!requireAuth()){pad(empty('Войдите в аккаунт','После входа сможете публиковать объявления и отслеживать их статус.'));return}loadMark();const {data,error}=await sb.from('classifieds').select('id,city,title,deal_type,category,description,price_rub,status,created_at,rejection_reason,author_id').eq('author_id',state.user.id).order('created_at',{ascending:false}).limit(100);if(error)throw error;if(!data?.length){pad(empty('У вас пока нет объявлений','Нажмите «Подать объявление», чтобы создать первое.'));return}await gridCards(data,'mine')}
function field(label,name,placeholder='',type='text',value=''){const lab=elem('label','field',[label]);const el=document.createElement(type==='textarea'?'textarea':type==='select'?'select':'input');el.name=name;if(type==='select'){for(const option of placeholder){const op=document.createElement('option');op.value=Array.isArray(option)?option[0]:option;op.textContent=Array.isArray(option)?option[1]:option;el.append(op)}}else if(type==='textarea'){el.placeholder=placeholder;el.maxLength=4000}else{el.placeholder=placeholder;el.type=type;el.maxLength=160}el.value=String(value??'');el.autocomplete='off';lab.append(el);return lab}
function entry(form,name){return form.elements.namedItem(name)?.value?.trim()||''}
async function uploadPhotos(listingId, files, uploadedFiles){files=files.filter(file=>!uploadedFiles.has(file));if(!files.length)return;const existing=await fetchPhotos([listingId]);const used=new Set((existing.get(listingId)||[]).map(p=>p.slot));if(used.size+files.length>10)throw new Error('Максимум 10 фотографий на объявление.');for(const file of files){if(!['image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw new Error('Фото должны быть в JPEG или WebP, не более 2 МБ каждое.');let slot=0;while(used.has(slot))slot++;if(slot>9)throw new Error('Максимум 10 фотографий на объявление.');const format=file.type==='image/jpeg'?'jpg':'webp';const {data,error}=await sb.from('classified_photos').insert({listing_id:listingId,slot,format}).select('id,object_path').single();if(error)throw error;const {error:upErr}=await sb.storage.from(BUCKET).upload(data.object_path,file,{contentType:file.type,upsert:false});if(upErr){await sb.from('classified_photos').delete().eq('id',data.id);throw upErr}used.add(slot);uploadedFiles.add(file)}}
async function compose(){if(!requireAuth()){pad(empty('Требуется вход','Чтобы разместить объявление, войдите в «РЯДОМ».'));return}loadMark();let ad=null;if(state.editing){const {data,error}=await sb.from('classifieds').select('*').eq('id',state.editing).single();if(error)throw error;if(!data||data.author_id!==state.user.id||!['draft','rejected'].includes(data.status))throw new Error('Редактировать можно только свой черновик или отклонённое объявление.');ad=data}const box=elem('section','panel',[h2(ad?'Редактирование объявления':state.haltura?'Новое задание':'Новое объявление')]);if(ad?.rejection_reason)box.append(elem('p','alert error',['Причина отклонения: '+ad.rejection_reason]));const form=elem('form','form-grid');const fields=[field('Город','city',state.cities,'select',ad?.city||state.city),field('Тип','deal_type',Object.entries(DEAL_TYPES).filter(([type])=>!state.haltura||['gig_offer','gig_seek'].includes(type)),'select',ad?.deal_type||(state.haltura?'gig_offer':'sell')),field('Категория','category',CATEGORIES,'select',ad?.category||(state.haltura?'Подработка':CATEGORIES[0])),field('Район (необязательно)','district','Например, центр','text',ad?.district||''),field('Название','title',state.haltura?'Например, помочь перенести мебель':'Что продаёте или ищете','text',ad?.title||''),field('Цена, ₽ (необязательно)','price_rub','Например, 2500','number',ad?.price_rub||''),field('Описание','description',state.haltura?'Что нужно сделать, когда и какие условия оплаты':'Подробности о товаре или услуге','textarea',ad?.description||'')];if(ad)fields[0].querySelector('select').disabled=true;fields[6].classList.add('full');fields[4].querySelector('input').maxLength=140;fields[4].querySelector('input').required=true;fields[6].querySelector('textarea').minLength=15;fields[6].querySelector('textarea').required=true;const privacy=elem('p','field full listing-safety-note',['Для вакансий и резюме: не публикуйте паспортные данные, домашний адрес и документы. Связаться можно через личные сообщения «РЯДОМ».']);
const photo=field('Фото (до 10 штук, JPEG/WebP, до 2 МБ)','images','','file');photo.classList.add('full');photo.querySelector('input').multiple=true;photo.querySelector('input').accept='image/jpeg,image/webp';
 const photoInput=photo.querySelector('input');
 const selectedFiles=[];
 const savedPhotos=ad?(await fetchPhotos([ad.id])).get(ad.id)||[]:[];
 const photoCount=note('');photoCount.classList.add('photo-count');photoCount.setAttribute('role','status');
 const selectedList=elem('div','photo-strip');
 function showSelection(){
  photoCount.textContent=`Фото: ${savedPhotos.length+selectedFiles.length} из 10`;
  selectedList.replaceChildren();
  selectedFiles.forEach((file,index)=>{
   const tile=elem('div','photo-tile',[elem('span','',[file.name])]);
   const remove=btn('Убрать',()=>{selectedFiles.splice(index,1);showSelection()},'btn small secondary');
   remove.setAttribute('aria-label','Убрать фото '+file.name);tile.append(remove);selectedList.append(tile);
  });
 }
 photoInput.addEventListener('change',()=>{
  const incoming=[...photoInput.files];photoInput.value='';
  if(savedPhotos.length+selectedFiles.length+incoming.length>10){show('Максимум 10 фотографий. Уберите лишние и выберите снова.',true);return;}
  if(incoming.some(file=>!['image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)){show('Фото должны быть в JPEG или WebP, не более 2 МБ каждое.',true);return;}
  selectedFiles.push(...incoming);showSelection();
 });
 photo.append(photoCount,selectedList);showSelection();
const typeInput=fields[1].querySelector('select');
const categoryInput=fields[2].querySelector('select');
const titleInput=fields[4].querySelector('input');
const priceInput=fields[5].querySelector('input');
function adaptType(resetCategory=false){
 const type=typeInput.value;
 if(resetCategory&&CATEGORY_BY_TYPE[type])categoryInput.value=CATEGORY_BY_TYPE[type];
 const noPrice=FREE_TYPES.has(type);
 fields[5].hidden=noPrice;
 priceInput.disabled=noPrice;
 if(noPrice)priceInput.value='';
 fields[5].firstChild.nodeValue=REWARD_TYPES.has(type)?'Вознаграждение, ₽ (необязательно)':EARNING_TYPES.has(type)?'Оплата, ₽ (необязательно)':'Цена, ₽ (необязательно)';
 priceInput.placeholder=EARNING_TYPES.has(type)?'Например, 40000':'Например, 2500';
 titleInput.placeholder=type==='resume'?'Например, Повар с опытом работы':type==='vacancy'?'Кого ищете на работу':type==='job_seek'?'Какую работу ищете':type==='ride_share'?'Маршрут и дата поездки':type==='lost'?'Что потеряли':type==='found'?'Что нашли':'Что предлагаете или ищете';
}
typeInput.addEventListener('change',()=>adaptType(true));adaptType(false);
for(const f of [...fields,privacy,photo])form.append(f);const actions=elem('div','form-actions');const save=btn('Сохранить черновик',()=>submit('draft'));const send=btn('Отправить на проверку',()=>submit('pending'),'btn secondary');actions.append(save,send);form.append(elem('div','field full',[actions]));box.append(form);if(ad){const gallery=await fetchPhotos([ad.id]);const pics=gallery.get(ad.id)||[];if(pics.length){const photos=elem('div','photo-strip');for(const p of pics){const tile=elem('div','photo-tile');const img=document.createElement('img');img.alt='Фото объявления';const url=await photoUrl(p.object_path);if(url)img.src=url;tile.append(img,btn('Удалить',()=>act(async()=>{const {error:del}=await sb.storage.from(BUCKET).remove([p.object_path]);if(del)throw del;const {error:db}=await sb.from('classified_photos').delete().eq('id',p.id);if(db)throw db;goto('new',{edit:ad.id})}),'btn small danger'));photos.append(tile)}box.append(h2('Загруженные фото'),photos)}}pad(box);
 const uploadedFiles=new Set();
 async function submit(target){if(!form.reportValidity())return;save.disabled=send.disabled=true;try{const price=entry(form,'price_rub');const payload={city:entry(form,'city'),deal_type:entry(form,'deal_type'),category:entry(form,'category'),district:entry(form,'district'),title:entry(form,'title'),description:entry(form,'description'),price_rub:FREE_TYPES.has(entry(form,'deal_type'))?null:(price?Number(price):null)};if(payload.title.length<5||payload.description.length<15)throw new Error('Название — от 5 символов, описание — от 15.');if(price&&(Number(price)<0||Number(price)>999999999.99))throw new Error('Проверьте цену.');await verifyHuman(sb,'classified',ad?.id??null);let id=ad?.id;if(ad){await saveOwnedDraft(sb,id,state.user.id,payload)}else{const {data,error}=await sb.from('classifieds').insert(payload).select('id').single();if(error)throw error;id=data.id;ad={...payload,id};fields[0].querySelector('select').disabled=true}await uploadPhotos(id,selectedFiles,uploadedFiles);if(target==='pending'){await submitOwnedDraft(sb,id,state.user.id)}goto('mine');show(target==='pending'?'Объявление отправлено на модерацию.':'Черновик сохранён.')}catch(e){show(errorText(e),true)}finally{save.disabled=send.disabled=false}}
}
async function detail(){loadMark();const id=state.activeAd;if(!id)return goto('feed');const {data:ad,error}=await sb.from('classifieds').select('id,author_id,city,title,deal_type,category,description,district,price_rub,status,created_at').eq('id',id).maybeSingle();if(error)throw error;if(!ad){pad(empty('Объявление недоступно','Оно было скрыто или удалено.'));return}const photoMap=await fetchPhotos([id]);const files=photoMap.get(id)||[];const layout=elem('div','details');const gallery=elem('div');let image=elem('div','main-photo');image.style.display='grid';image.style.placeItems='center';if(!files.length)image.replaceChildren(createPhotoPlaceholder());gallery.append(image);const thumbs=elem('div','thumbs');for(const [i,p] of files.entries()){const url=await photoUrl(p.object_path);if(!url)continue;const t=document.createElement('img');t.src=url;t.alt='Фото '+(i+1);t.onclick=()=>{const full=document.createElement('img');full.className='main-photo';full.src=url;full.alt='Фотография объявления';full.onerror=()=>{const fallback=elem('div','main-photo');fallback.append(createPhotoPlaceholder());full.replaceWith(fallback);image=fallback};image.replaceWith(full);image=full};thumbs.append(t);if(i===0){const full=document.createElement('img');full.className='main-photo';full.src=url;full.alt='Фотография объявления';full.onerror=()=>{const fallback=elem('div','main-photo');fallback.append(createPhotoPlaceholder());full.replaceWith(fallback);image=fallback};image.replaceWith(full);image=full}}if(image.tagName==='DIV'&&!image.childNodes.length)image.append(createPhotoPlaceholder());gallery.append(thumbs);const info=elem('section','panel',[h2(ad.title),elem('p','price',[listingPrice(ad.price_rub,ad.deal_type)]),note(DEAL_TYPES[ad.deal_type]+' · '+ad.city+' · '+(ad.district||'Все районы')),labelStatus(ad.status),elem('p','',[ad.description]),note('Создано: '+datetime(ad.created_at))]);if(ad.status==='published'&&ad.author_id!==state.user?.id){
 const contact=btn(contactLabel(ad.deal_type),()=>void contactSeller(ad,contact),'btn contact');
 info.append(contact);
}
if(ad.author_id===state.user?.id){
 const ownerActions=elem('div','form-actions');
 ownerActions.append(btn('Мои объявления',()=>goto('mine'),'btn secondary'),
  btn('Отклики и сообщения',()=>goto('inbox'),'btn secondary'));
 info.append(ownerActions);
}layout.append(gallery,info);pad(layout)}
async function inbox(){if(!requireAuth()){pad(empty('Войдите, чтобы переписываться','Ваши диалоги доступны только после авторизации.'));return}loadMark();const {data:convs,error}=await sb.from('classified_conversations').select('id,listing_id,buyer_id,seller_id,created_at').order('created_at',{ascending:false}).limit(100);if(error)throw error;if(!convs?.length){pad(empty('Сообщений пока нет','Откройте объявление и нажмите «Написать автору» или «Откликнуться».'));return}const {data:ads,error:adsError}=await sb.from('classifieds').select('id,title,city').in('id',convs.map(x=>x.listing_id));if(adsError)throw adsError;const names=new Map((ads||[]).map(x=>[x.id,x.title]));let unread;
 try{unread=await rpc('get_classified_unread_counts',{})||[]}catch{unread=[]}
 const unreadById=new Map(unread.map(x=>[x.conversation_id,Number(x.unread_count)||0]));
 const list=elem('div','chat-list');
 for(const conv of convs){
  const isSeller=conv.seller_id===state.user.id;
  const count=unreadById.get(conv.id)||0;
  const label=(names.get(conv.listing_id)||'Объявление')+
    (isSeller?' · Откликнувшийся':' · Автор объявления')+
    (count?' · Новых сообщений: '+count:'')+
    ' · '+datetime(conv.created_at);
  list.append(btn(label,()=>goto('chat',{chat:conv.id}),'chat-button'+(count?' unread':'')));
 }pad(elem('section','panel',[h2('Ваши диалоги'),list]))}
async function chat(){if(!requireAuth()){pad(empty('Необходимо войти','Переписка приватная.'));return}loadMark();const id=state.chat;if(!id)return goto('inbox');const {data:c,error:ce}=await sb.from('classified_conversations').select('id,listing_id,buyer_id,seller_id').eq('id',id).maybeSingle();if(ce)throw ce;if(!c){pad(empty('Диалог недоступен','Вы не участник этой переписки.'));return}const {data:a}=await sb.from('classifieds').select('title').eq('id',c.listing_id).maybeSingle();const isSeller=c.seller_id===state.user.id;
 const panel=elem('section','panel chat',[h2('Переписка · '+(a?.title||'Объявление')),
  note(isSeller?'Вы автор объявления. Здесь можно отвечать на отклики.':'Вы откликнулись на объявление. Здесь можно написать его автору.')]);const msgs=elem('div','messages');
 const actor=state.user.id;
 let history=[],hasOlder=true,latestLoading=false,olderLoading=false;
 const active=()=>state.view==='chat'&&state.chat===id&&state.user?.id===actor&&panel.isConnected;
 const older=btn('Показать предыдущие сообщения',()=>act(async()=>{
  if(olderLoading||!history.length)return;
  olderLoading=true;older.disabled=true;
  try{
   const data=await readChatMessages(sb,id,history[0]);
   if(!active())return;
   hasOlder=data.length===MESSAGE_PAGE_SIZE;mergeMessages(data,true);
  }finally{olderLoading=false;older.disabled=false;}
 }),'btn secondary small');
 function mergeMessages(data,prepend=false){
  const height=msgs.scrollHeight,top=msgs.scrollTop;
  const atBottom=height-top-msgs.clientHeight<40;
  const known=new Map(history.map(message=>[message.id,message]));
  for(const message of data)known.set(message.id,message);
  history=[...known.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  msgs.replaceChildren();
  for(const m of history)msgs.append(elem('div','bubble'+(m.sender_id===actor?' self':''),[elem('div','',[m.body]),elem('time','',[datetime(m.created_at)])]));
  if(hasOlder&&history.length)msgs.before(older);else older.remove();
  if(prepend)msgs.scrollTop=top+msgs.scrollHeight-height;
  else msgs.scrollTop=atBottom?msgs.scrollHeight:top;
 }
 const sendForm=elem('form','chat-send');const message=document.createElement('textarea');message.maxLength=2000;message.required=true;message.placeholder='Напишите сообщение…';const send=elem('button','btn',['Отправить']);send.type='submit';sendForm.append(message,send);sendForm.onsubmit=async(event)=>{event.preventDefault();const body=message.value.trim();if(!body)return;send.disabled=true;try{await rpc('send_classified_message',{p_conversation_id:id,p_body:body});message.value='';await updateChat()}catch(e){show(errorText(e),true)}finally{send.disabled=false}};panel.append(msgs,sendForm,
  elem('div','form-actions',[
   btn('Все сообщения',()=>goto('inbox'),'btn secondary small'),
   btn('Обновить переписку',()=>act(updateChat),'btn secondary small')
  ]));pad(panel);
 await updateChat();
 stopChatTimer();
 chatTimer=setInterval(()=>{if(!document.hidden&&state.view==='chat'&&state.chat===id)void updateChat().catch(()=>{});},12000);
 async function updateChat(){
  if(latestLoading||!active())return;
  latestLoading=true;
  try{
   const data=await readChatMessages(sb,id);
   if(!active())return;
   if(!history.length)hasOlder=data.length===MESSAGE_PAGE_SIZE;
   mergeMessages(data);
   if(data.length)await rpc('mark_classified_messages_read',{p_conversation_id:id,p_message_id:data[data.length-1].id});
  }finally{latestLoading=false;}
 }
}

async function moderatorHide(ad){
 if(!window.confirm('Снять объявление «'+ad.title+'» с публикации? Оно исчезнет из поиска, но сохранится в архиве модерации.'))return;
 await rpc('moderator_hide_classified',{p_listing_id:ad.id});
 goto('moderation');show('Объявление снято с публикации и скрыто от посетителей.');
}
async function moderatorDelete(ad){
 if(!window.confirm('Удалить объявление «'+ad.title+'» НАВСЕГДА? Будут безвозвратно удалены объявление, его фотографии, личные переписки и история модерации.'))return;
 if(!window.confirm('Подтвердите окончательное удаление. Восстановить данные будет невозможно.'))return;
 let hidden=false;
 try{
  await rpc('moderator_hide_classified',{p_listing_id:ad.id});
  hidden=true;
  const {data:photos,error:photoErr}=await sb.from('classified_photos').select('object_path').eq('listing_id',ad.id);
  if(photoErr)throw photoErr;
  const paths=(photos||[]).map(x=>x.object_path).filter(Boolean);
  if(paths.length){
   const {error:storageError}=await sb.storage.from(BUCKET).remove(paths);
   if(storageError)throw storageError;
  }
  await rpc('moderator_delete_classified',{p_listing_id:ad.id});
  goto('moderation');show('Объявление и связанные данные удалены окончательно.');
 }catch(e){
  show((hidden?'Объявление уже скрыто от посетителей. Но окончательное удаление не удалось: ':'Не удалось снять объявление: ')+errorText(e),true);
 }
}
async function moderation(){
 const permitted=allowedModerationCities();
 if(!state.user||!permitted.length){pad(empty('Нет доступа к модерации','Для модерации нужен доступ редактора города или владельца платформы.'));return}
 loadMark();
 if(!permitted.includes(state.moderationCity))state.moderationCity=permitted[0];
 const city=state.moderationCity;
 const statuses={pending:'Ожидают проверки',published:'Опубликованные',archived:'Снятые с публикации',rejected:'Отклонённые',completed:'Завершённые'};
 let status=sessionStorage.getItem('ryadom.classified.moderation.status')||'pending';
 if(!statuses[status])status='pending';
 let query=sb.from('classifieds').select('id,title,city,description,category,deal_type,price_rub,status,created_at').eq('status',status).order('created_at',{ascending:status==='pending'}).limit(100);
 if(city!=='*')query=query.eq('city',city);
 const {data,error}=await query;
 if(error)throw error;
 const top=elem('section','panel moderation-intro',[h2('Модерация объявлений'),note(state.isOwner?'Владелец платформы: доступны объявления всех городов.':'Партнёр: доступны объявления только закреплённых городов.')]);
 const filters=elem('div','moderation-filters');
 const cities=elem('label','field moderation-filter',['Очередь города']);
 const citySelect=document.createElement('select');
 for(const name of permitted){const option=document.createElement('option');option.value=name;option.textContent=name==='*'?'Все города':name;citySelect.append(option)}
 citySelect.value=city;
 citySelect.addEventListener('change',()=>{state.moderationCity=citySelect.value;sessionStorage.setItem('ryadom.classified.moderation.city',citySelect.value);goto('moderation')});
 cities.append(citySelect);
 const kinds=elem('label','field moderation-filter',['Статус объявления']);
 const statusSelect=document.createElement('select');
 for(const [value,label] of Object.entries(statuses)){const option=document.createElement('option');option.value=value;option.textContent=label;statusSelect.append(option)}
 statusSelect.value=status;
 statusSelect.addEventListener('change',()=>{sessionStorage.setItem('ryadom.classified.moderation.status',statusSelect.value);goto('moderation')});
 kinds.append(statusSelect);
 filters.append(cities,kinds);
 top.append(filters,elem('p','moderation-counter',['Найдено: '+(data?.length||0)]));
 const wrapper=elem('div','',[top]);
 if(!data?.length){wrapper.append(empty('Объявлений не найдено','В этом городе пока нет объявлений с выбранным статусом.'));pad(wrapper);return}
 const photos=await fetchPhotos(data.map(x=>x.id));
 for(const ad of data){
  const panel=elem('section','panel moderation-card',[h2(ad.title),labelStatus(ad.status),note(ad.description),elem('p','price',[listingPrice(ad.price_rub,ad.deal_type)]),note(ad.city+' · '+ad.category+' · '+datetime(ad.created_at))]);
  const pics=photos.get(ad.id)||[];
  if(pics.length){const row=elem('div','photo-strip');for(const p of pics){const u=await photoUrl(p.object_path);if(!u)continue;const im=document.createElement('img');im.className='photo-tile';im.src=u;im.alt='Фото объявления';im.loading='lazy';row.append(im)}panel.append(row)}
  const actions=elem('div','form-actions');
  if(ad.status==='pending'){
   actions.append(btn('Одобрить',()=>act(async()=>{await rpc('review_classified_with_reason',{p_listing_id:ad.id,p_approve:true,p_reason:null});goto('moderation');show('Объявление опубликовано.')})));
   actions.append(btn('Отклонить',()=>{
    const reason=window.prompt('Укажите причину отклонения (10–500 символов):');
    if(reason===null)return;
    if(reason.trim().length<10||reason.trim().length>500){show('Укажите причину от 10 до 500 символов.',true);return}
    void act(async()=>{await rpc('review_classified_with_reason',{p_listing_id:ad.id,p_approve:false,p_reason:reason.trim()});goto('moderation');show('Объявление отклонено.')});
   },'btn secondary'));
  }
  if(ad.status!=='archived')actions.append(btn('Снять с публикации',()=>act(()=>moderatorHide(ad)),'btn secondary'));
  actions.append(btn('Удалить навсегда',()=>void moderatorDelete(ad),'btn danger'));
  panel.append(actions);wrapper.append(panel);
 }
 pad(wrapper);
}
let renderQueue=Promise.resolve();
function render(){const view=state.view;const next=renderQueue.catch(()=>{}).then(()=>renderCurrent(view));renderQueue=next;return next;}
async function renderCurrent(view){if(view!==state.view)return;await authRefresh();if(view!==state.view)return;ui.tabs.querySelectorAll('button[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===state.view&&!(state.haltura&&x.dataset.view==='feed')));if(['mine','new','inbox','chat'].includes(state.view)&&!state.user)return pad(empty('Требуется вход в аккаунт','Нажмите «Войти / зарегистрироваться» вверху страницы.'));switch(state.view){case'feed':return feed();case'mine':return mine();case'new':return compose();case'detail':return detail();case'inbox':return inbox();case'chat':return chat();case'moderation':return moderation();default:return feed()}}
ui.city.onchange=()=>{state.city=ui.city.value;localStorage.setItem('ryadom.classified.city',state.city);goto('feed')};ui.tabs.addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(b){if(b.dataset.view==='feed'&&state.haltura){state.haltura=false;state.typeFilter='';state.filter='';updateHaltura();}goto(b.dataset.view)}});sb.auth.onAuthStateChange(()=>{setTimeout(()=>{void authRefresh()},0)});ui.tabs.querySelectorAll('button[data-view]').forEach(button=>button.disabled=true);document.querySelector('[data-haltura]').onclick=()=>{state.haltura=!state.haltura;state.typeFilter='';state.filter='';updateHaltura();goto('feed');};updateHaltura();void (async()=>{await loadCities();await render()})().finally(()=>{ui.tabs.querySelectorAll('button[data-view]').forEach(button=>button.disabled=false)}).catch(e=>{pad(empty('Не удалось загрузить объявления','Попробуйте обновить страницу.'));show(errorText(e),true)});
