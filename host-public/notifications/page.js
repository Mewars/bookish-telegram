import {c as createClient} from '/wall/supabase-client.js';
const sb=createClient('https://cptbmepnbzogqkfhflsg.supabase.co','sb_publishable_-LLEHXpg_rqIZ_vUdPnwTQ_0ajeVm37',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});
const main=document.querySelector('#content'),status=document.querySelector('#status');
const state={user:null,pref:null,roles:[],notifications:[],reads:new Set(),cities:[]};
const E=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!=null)el.textContent=txt;return el};
function message(t,err=false){status.textContent=t;status.className=err?'error':''}
function field(label,tag='input',value=''){const wrap=E('label','field');const text=E('span','',label);const n=E(tag);if(tag==='textarea')n.rows=4;n.value=value;wrap.append(text,n);return {wrap,input:n}}
const validPath=p=>typeof p==='string'&&p.startsWith('/')&&!p.startsWith('//')?p:'/';
function supportsPush(){return 'Notification' in window&&'PushManager' in window&&'serviceWorker' in navigator&&location.protocol==='https:'}
function onIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)}
function standalone(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
function decodeKey(b64){const raw=atob(b64.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-b64.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function refresh(){
 if(!state.user)return;
 const [prefs,roles,notifications,reads,cities]=await Promise.all([
  sb.from('ryadom_notification_preferences').select('city,site_enabled,push_enabled').eq('user_id',state.user.id).maybeSingle(),
  sb.from('city_admin_access').select('city,role,active').eq('user_id',state.user.id).eq('active',true),
  sb.from('ryadom_site_notifications').select('id,city,title,body,target_path,created_at').order('created_at',{ascending:false}).limit(100),
  sb.from('ryadom_notification_reads').select('notification_id').eq('user_id',state.user.id).limit(500),
  sb.from('city_directory').select('name').eq('active',true).order('name')
 ]);
 for(const r of [prefs,roles,notifications,reads,cities])if(r.error)throw r.error;
 state.pref=prefs.data||{city:'Енисейск',site_enabled:true,push_enabled:false};
 state.roles=roles.data||[];state.notifications=notifications.data||[];
 state.reads=new Set((reads.data||[]).map(x=>x.notification_id));state.cities=cities.data?.map(x=>x.name)||['Енисейск'];
 render();
}
async function savePrefs(fields){
 const next={user_id:state.user.id,city:state.pref.city,site_enabled:state.pref.site_enabled,push_enabled:state.pref.push_enabled,...fields,updated_at:new Date().toISOString()};
 const {error}=await sb.from('ryadom_notification_preferences').upsert(next,{onConflict:'user_id'});
 if(error)throw error;state.pref=next;
}
async function enablePush(b){
 if(!supportsPush()){message('Этот браузер не поддерживает web-push. Сообщения внутри сайта остаются доступны.',true);return}
 if(onIOS()&&!standalone()){message('На iPhone: откройте сайт в Safari → «Поделиться» → «На экран Домой». Затем запустите «Встречай» с экрана и включите уведомления.',true);return}
 b.disabled=true;
 try{
  // Browser permission prompt is directly caused by a user click.
  const permission=await Notification.requestPermission();
  if(permission!=='granted'){message('Разрешение не получено. Его можно изменить в настройках браузера.',true);return}
  const {data:key,error:keyError}=await sb.rpc('ryadom_push_public_key');if(keyError||!key)throw keyError||Error('Нет ключа push');
  const reg=await navigator.serviceWorker.register('/notifications/push-sw.js',{scope:'/notifications/'});
  await navigator.serviceWorker.ready;
  let subscription=await reg.pushManager.getSubscription();
  if(!subscription)subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(key)});
  const {error}=await sb.from('ryadom_push_subscriptions').upsert({endpoint:subscription.endpoint,user_id:state.user.id,payload:subscription.toJSON(),updated_at:new Date().toISOString()},{onConflict:'endpoint'});
  if(error)throw error;
  await savePrefs({push_enabled:true,site_enabled:true});message('Уведомления на этом устройстве включены.');render();
 }catch(e){message('Не удалось включить push: '+(e.message||String(e)),true)}
 finally{b.disabled=false}
}
async function disablePush(b){
 b.disabled=true;
 try{
  const reg=await navigator.serviceWorker.getRegistration('/notifications/');
  const sub=reg?await reg.pushManager.getSubscription():null;
  if(sub){await sb.from('ryadom_push_subscriptions').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe()}
  await savePrefs({push_enabled:false});message('Push отключены на этом устройстве.');render();
 }catch(e){message(e.message||String(e),true)}finally{b.disabled=false}
}
function render(){
 main.replaceChildren();
 if(!state.user){const p=E('section','panel');p.append(E('h2','','Войдите во «Встречай»'),E('p','','Для чтения уведомлений и настройки push требуется аккаунт.'));const a=E('a','','Открыть профиль и войти');a.href='/#/profile';p.append(a);main.append(p);return}
 const settings=E('section','panel');settings.append(E('h2','','Настройки уведомлений'));
 const city=field('Город уведомлений','select');for(const name of state.cities){const o=E('option','',name);o.value=name;city.input.append(o)}city.input.value=state.pref.city;
 const site=E('label','field');const siteCheckbox=E('input');siteCheckbox.type='checkbox';siteCheckbox.checked=state.pref.site_enabled;siteCheckbox.style.width='auto';site.append(E('span','','Показывать уведомления на сайте'),siteCheckbox);
 const settingsGrid=E('div','grid');settingsGrid.append(city.wrap,site);settings.append(settingsGrid);
 const save=E('button','primary','Сохранить настройки');save.onclick=async()=>{save.disabled=true;try{await savePrefs({city:city.input.value,site_enabled:siteCheckbox.checked});message('Настройки сохранены.');await refresh()}catch(e){message(e.message,true)}finally{save.disabled=false}};
 const acts=E('div','actions');acts.append(save);
 const enable=E('button','',state.pref.push_enabled?'Отключить push':'Включить push на этом устройстве');enable.onclick=()=>state.pref.push_enabled?void disablePush(enable):void enablePush(enable);acts.append(enable);
 const test=E('button','','🔔 Проверить push на моём устройстве');test.type='button';test.onclick=async()=>{
  test.disabled=true;message('Отправляем тестовое уведомление…');try{
   const {data,error}=await sb.functions.invoke('ryadom-test-push',{body:{}});
   if(error)throw error;if(data?.error)throw Error(data.error);
   message('Тест: подписок '+(data?.attempted??0)+', принято сервисом '+(data?.accepted??0)+', ошибок '+(data?.failed??0)+'. '+(data?.detail||'')+(Array.isArray(data?.errors)&&data.errors.length?' '+data.errors.join(', '):''));
  }catch(e){message('Проверка push: '+(e.message||String(e)),true)}finally{test.disabled=false}
 };acts.append(test);settings.append(acts);
 if(!supportsPush())settings.append(E('p','fine','Этот браузер не поддерживает push. Сообщения можно читать здесь.'));
 else if(onIOS()&&!standalone())settings.append(E('p','notice','На iPhone установите сайт на экран «Домой» через Safari. Только после этого доступны web-push.'));
 if('Notification' in window && Notification.permission==='denied')settings.append(E('p','fine','Вы запретили уведомления в браузере. Разрешение нужно включить в настройках устройства.'));
 main.append(settings);
 if(state.roles.length){const admin=E('section','panel');admin.append(E('h2','','Уведомление от администрации'));
  const destinations=E('select');const owner=state.roles.some(r=>r.role==='owner'&&r.city==='*');if(owner){const o=E('option','','Все города');o.value='*';destinations.append(o)}
  const allowed=owner?state.cities:[...new Set(state.roles.filter(r=>r.role==='editor').map(r=>r.city))];
  for(const name of allowed){const o=E('option','',name);o.value=name;destinations.append(o)}
  if(destinations.options.length){const cityF=E('label','field');cityF.append(E('span','','Куда отправить'),destinations);
   const title=field('Заголовок');title.input.maxLength=110;title.input.placeholder='Важная новость города';
   const body=field('Текст уведомления','textarea');body.input.maxLength=500;body.input.placeholder='Напишите краткое сообщение для жителей';
   const dest=field('Открыть при нажатии','select');
   const options=[['/','Главная страница'],['/wall/','Городская стена'],['/classifieds/','Объявления'],['/#/events','Афиша'],['/#/places','Места'],['/#/services','Услуги'],['/donate/','Поддержать'],['/notifications/','Все уведомления'],['custom','Другая страница «Встречай»']];
   for(const [path,text] of options){const o=E('option','',text);o.value=path;dest.input.append(o)}
   dest.input.value='/';
   const custom=field('Адрес страницы сайта (начинается с /)');custom.input.placeholder='/wall/';custom.wrap.hidden=true;
   dest.input.onchange=()=>{custom.wrap.hidden=dest.input.value!=='custom';if(!custom.wrap.hidden)custom.input.focus()};
   const selectedDestination=()=>dest.input.value==='custom'?custom.input.value.trim():dest.input.value;
   const form=E('form');form.append(cityF,title.wrap,body.wrap,dest.wrap,custom.wrap);
   const submit=E('button','primary','Отправить уведомление');submit.type='submit';
   form.onsubmit=async ev=>{ev.preventDefault();const path=selectedDestination();if(!validPath(path).startsWith('/')||validPath(path)!==path||path.length>350){message('Укажите внутренний адрес сайта, начинающийся с /',true);return}
    if(!confirm('Отправить уведомление жителям?'))return;submit.disabled=true;try{
    const {data,error}=await sb.functions.invoke('ryadom-send-push',{body:{city:destinations.value,title:title.input.value.trim(),body:body.input.value.trim(),path}});
    if(error)throw error;if(data?.error)throw Error(data.error);
    message('Уведомление сохранено на сайте (ищите его ниже в «Все уведомления»). Это не означает доставку на телефон. Подписок для push: '+(data?.attempted??0)+'; принято push-сервисом: '+(data?.delivered??0)+'; ошибок: '+(data?.failed??0)+'.'+((data?.attempted??0)===0?' На выбранный город пока нет активных подписок.':'')+(data?.push_ready===false?' Сервер push недоступен.':''));title.input.value='';body.input.value='';await refresh();
   }catch(e){message('Ошибка отправки: '+(e.message||e),true)}finally{submit.disabled=false}};
   form.append(submit,E('p','fine','Уведомления внутри сайта и push на телефон — разные каналы. В списке ниже запись появится даже без push-подписок. Push получают только жители, которые самостоятельно разрешили уведомления на своём устройстве. До 10 рассылок в час.'));
   admin.append(form);main.append(admin)
  }
 }
 const ownerPrivileges=state.roles.some(r=>r.role==='owner'&&r.city==='*'&&r.active);
 const inbox=E('section','panel');inbox.append(E('h2','','Все уведомления'));
 if(!state.notifications.length)inbox.append(E('p','muted','Пока уведомлений нет.'));
 for(const item of state.notifications){const article=E('article','record');if(!state.reads.has(item.id))article.append(E('span','unread-marker'));article.append(E('strong','',item.title),E('p','',item.body));const small=E('time','',new Date(item.created_at).toLocaleString('ru-RU'));article.append(small);
  const row=E('div','record-actions');
  const a=E('a','','Открыть раздел ↗');a.href=validPath(item.target_path);a.onclick=()=>{void sb.from('ryadom_notification_reads').upsert({user_id:state.user.id,notification_id:item.id},{onConflict:'user_id,notification_id',ignoreDuplicates:true})};row.append(a);
  const targetLabel=E('span','muted','Назначение: '+({ '/':'Главная','/wall/':'Стена','/classifieds/':'Объявления','/donate/':'Поддержать','/notifications/':'Уведомления'}[item.target_path]||item.target_path));row.append(targetLabel);
  if(!state.reads.has(item.id)){const mark=E('button','','Прочитано');mark.onclick=async()=>{const {error}=await sb.from('ryadom_notification_reads').upsert({user_id:state.user.id,notification_id:item.id},{onConflict:'user_id,notification_id',ignoreDuplicates:true});if(error){message(error.message,true);return}state.reads.add(item.id);render()};row.append(mark)}
  if(ownerPrivileges){const remove=E('button','danger','Убрать уведомление');remove.type='button';remove.onclick=async()=>{
   if(!confirm('Убрать это уведомление у всех жителей? Обратно в ленту оно автоматически не вернётся.'))return;
   remove.disabled=true;try{const {data,error}=await sb.rpc('ryadom_owner_hide_notification',{p_notification_id:item.id});
   if(error)throw error;if(!data)throw Error('Уведомление не найдено');message('Уведомление убрано из ленты.');await refresh()}
   catch(e){message('Удаление недоступно: '+(e.message||e)+'. Права на удаление должны быть установлены в Supabase.',true)}finally{remove.disabled=false}
  };row.append(remove)}
  article.append(row);inbox.append(article)
 }
 main.append(inbox);
}
(async()=>{try{const {data}=await sb.auth.getUser();state.user=data?.user||null;await refresh();if(location.hash==='#push')message('Нажмите «Включить push на этом устройстве», чтобы дать разрешение.');}catch(e){message('Не удалось загрузить уведомления: '+(e.message||e),true)}})();
sb.auth.onAuthStateChange(()=>setTimeout(async()=>{const {data}=await sb.auth.getUser();if(data?.user?.id!==state.user?.id){state.user=data?.user||null;void refresh()}},100));

setInterval(()=>{if(state.user&&!document.hidden)refresh().catch(()=>{})},30000);
