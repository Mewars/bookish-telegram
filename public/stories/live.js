import {mountStoryEditor} from './editor.js?v=20261027round1';
const storyPath=s=>s.mime_type?.startsWith('video/')?s.object_path.replace(/\.webp$/,s.mime_type==='video/mp4'?'.mp4':'.webm'):s.object_path;
// Private Storage and server moderation. Missing schema hides the feature until approved.
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const btn=(label,action,cls='rs-button')=>{const b=el('button',cls,label);b.type='button';b.onclick=action;return b;};
const statusLabel=s=>({draft:'Черновик',pending:'На проверке',published:Date.parse(s.expires_at)>Date.now()?'Опубликована':'Опубликована · В архиве',rejected:'Отклонена',removed:'Удалена'}[s.status]||s.status);
const friendly=e=>{const m=String(e?.message||'');if(m.includes('daily limit'))return 'Можно опубликовать до 5 историй за сутки.';if(m.includes('self approval'))return 'Свою историю должен проверить другой модератор или владелец.';if(m.includes('not authorized'))return 'Недостаточно прав. Проверьте вход и выбранный город.';if(m.includes('photo missing'))return 'Фотография ещё не загружена. Попробуйте отправить снова.';if(m.includes('duplicate key'))return 'Жалоба на эту историю уже отправлена.';if(m.includes('report limit'))return 'Достигнут дневной лимит жалоб.';return 'Не удалось выполнить действие. Повторите попытку.';};
export async function prepareStoryPhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Выберите JPG, PNG или WebP размером до 10 МБ.');
 const image=await createImageBitmap(file);
 try{if(!image.width||!image.height||image.width*image.height>40000000)throw Error('Слишком большое разрешение фотографии.');
  const ratio=Math.min(1,1080/image.width,1920/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  const photo=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));
  if(!photo||photo.type!=='image/webp'||photo.size>2097152)throw Error('Не удалось подготовить фото. Попробуйте изображение меньшего размера.');return photo;
 }finally{image.close();}
}
export function mountCityStories(root,{city,client:sb}){
 let refreshing=false,lastRefresh=0;const avatars=new Map();
 let alive=true,available=true,dirty=false,generation=0,user=null,items=[],interval=null,observer=null,videoEnabled=false,immediate=false;
 const dialogs=new Set(),urls=new Map(),pending=new Map();root.replaceChildren();root.hidden=true;root.style.display='none';
 const call=async(name,args)=>{const r=await sb.rpc(name,args);if(r.error)throw r.error;dirty=true;return r.data;};
 const note=el('p','rs-note');note.setAttribute('role','status');
 function message(t,error=false){if(!alive)return;note.textContent=t;note.classList.toggle('rs-error',error);}
 function modal(label){for(const existing of dialogs)for(const media of existing.querySelectorAll('video'))media.pause();const d=el('dialog','rs-dialog');d.setAttribute('aria-label',label);dialogs.add(d);document.body.append(d);const previous=document.activeElement;
  d.addEventListener('close',()=>{dialogs.delete(d);d.remove();if(previous?.isConnected)previous.focus();if(!dialogs.size&&alive&&dirty){dirty=false;void refresh();}},{once:true});d.showModal();return d;
 }
 function disposeMedia(clear=true){observer?.disconnect();observer=null;if(!clear)return;for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();pending.clear();}
 async function photo(story){
  if(urls.has(storyPath(story)))return urls.get(storyPath(story));
  if(pending.has(storyPath(story)))return pending.get(storyPath(story));
  const stamp=generation;
  const request=(async()=>{const r=await sb.storage.from('ryadom-stories').download(storyPath(story),{},{cache:'no-store'});if(r.error)throw r.error;if(!alive||stamp!==generation)throw Error('Stale story');const u=URL.createObjectURL(r.data);urls.set(storyPath(story),u);while(urls.size>2){const oldest=urls.keys().next().value;URL.revokeObjectURL(urls.get(oldest));urls.delete(oldest);}return u;})();
  pending.set(storyPath(story),request);try{return await request;}finally{if(pending.get(storyPath(story))===request)pending.delete(storyPath(story));}
 }
 function avatar(authorId,label){const wrap=el('span','rs-profile-avatar');wrap.setAttribute('aria-hidden','true');wrap.textContent=(label?.[0]||'Ж').toUpperCase();const raw=avatars.get(authorId);if(raw){try{const u=new URL(raw);if(u.protocol==='https:'&&!u.username&&!u.password){const image=el('img');image.alt='';image.referrerPolicy='no-referrer';image.loading='lazy';image.src=u.href;image.onerror=()=>image.remove();wrap.append(image);}}catch{}}return wrap;}
 function card(story,action){const b=btn('',action,'rs-card rs-author-card');b.setAttribute('aria-label','История: '+story.author_label);b.append(avatar(story.author_id,story.author_label));return b;}
 function storyNavigation(d){const nav=el('nav','rs-story-navigation');nav.setAttribute('aria-label','Навигация истории');nav.append(btn('← Назад',()=>d.close(),'rs-view-control'));const home=el('a','rs-view-control','На главную');home.href='/#/home?'+new URLSearchParams({city});home.addEventListener('click',()=>{for(const dialog of [...dialogs])dialog.close();if(location.pathname==='/')window.scrollTo({top:0,left:0,behavior:'instant'});});nav.append(home);return nav;}
 function signIn(){const d=modal('Вход для публикации истории');const box=el('div','rs-compose');box.append(el('h2','','Ваша история'),el('p','rs-note','Войдите в аккаунт «РЯДОМ», чтобы смотреть и публиковать истории.'),btn('Закрыть',()=>d.close()));const a=el('a','rs-button rs-gold','Войти на сайт');a.href='/#/login';box.append(a);d.append(box);}
 function textForm(title,label,submitText,action){const d=modal(title),form=el('form','rs-compose'),field=el('textarea'),error=el('p','rs-error');field.required=true;field.minLength=3;field.maxLength=500;field.rows=4;const l=el('label','rs-field',label);l.append(field);error.setAttribute('role','alert');const send=el('button','rs-button rs-gold',submitText);send.type='submit';form.append(el('h2','',title),l,error,send,btn('Отмена',()=>d.close()));d.append(form);form.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{await action(field.value.trim());d.close();}catch(e){error.textContent=friendly(e);}finally{send.disabled=false;}};field.focus();}
 function report(story){if(!user){signIn();return;}textForm('Пожаловаться на историю','Причина жалобы','Отправить жалобу',async reason=>{await call('report_city_story',{p_id:story.id,p_reason:reason});message('Жалоба отправлена городской команде.');});}
 function removeStory(story,done){void (async()=>{try{await call('remove_city_story',{p_id:story.id});const cached=urls.get(storyPath(story));if(cached)URL.revokeObjectURL(cached);urls.delete(storyPath(story));done();void sb.storage.from('ryadom-stories').remove([storyPath(story)]).catch(()=>{});message('История удалена.');}catch(e){message(friendly(e),true);}})();}
 function open(story,list=items,onClose=null){
  if(!user){signIn();return;}
  const d=modal('Просмотр истории'),opener=document.activeElement;let index=list.findIndex(x=>x.id===story.id),timer=null,elapsed=0,last=0,held=false,currentMedia=null,visibility=null,frame=0,loaded=false;
  const stop=()=>{if(visibility)document.removeEventListener('visibilitychange',visibility);visibility=null;clearInterval(timer);timer=null;currentMedia?.pause?.();};
  d.classList.add('rs-viewer');d.tabIndex=0;d.addEventListener('close',()=>{frame++;stop();if(alive)onClose?.();if(opener?.isConnected)opener.focus();},{once:true});
  function step(delta){const next=index+delta;if(next<0)return;if(next>=list.length){d.close();return;}index=next;void show();}
  function resume(){held=false;if(loaded&&currentMedia?.tagName==='VIDEO'&&!document.hidden)void currentMedia.play().catch(()=>{});}
  async function show(){
   stop();loaded=false;held=false;const seq=++frame,s=list[index];if(!s){d.close();return;}elapsed=0;
   const isVideo=s.mime_type?.startsWith('video/'),image=el(isVideo?'video':'img','rs-full-photo');currentMedia=image;if(isVideo){image.playsInline=true;image.muted=true;image.preload='auto';}else image.alt=s.caption||'История '+s.author_label;
   const error=el('div','rs-image-error'),loader=el('div','rs-story-loader'),pin=el('img'),bar=el('div','rs-progress');loader.setAttribute('role','status');loader.setAttribute('aria-label','Загрузка истории');pin.src='/brand/pin-yellow.svg';pin.alt='';loader.append(pin);error.setAttribute('role','alert');bar.setAttribute('aria-hidden','true');
   for(let i=0;i<list.length;i++){const segment=el('span'),fill=el('i');if(i<index)fill.style.width='100%';segment.append(fill);bar.append(segment);}
   const head=el('div','rs-view-head');head.append(avatar(s.author_id,s.author_label),el('span','',s.author_label));const close=btn('✕',()=>d.close(),'rs-view-control');close.setAttribute('aria-label','Закрыть историю');head.append(close);
   const prev=btn('‹',()=>step(-1),'rs-arrow rs-previous');prev.setAttribute('aria-label','Предыдущая история');prev.disabled=index===0;const next=btn('›',()=>step(1),'rs-arrow rs-next');next.setAttribute('aria-label','Следующая история');
   const foot=el('div','rs-view-foot');if(s.caption)foot.append(el('p','rs-caption',s.caption));
   if(isVideo){const sound=btn('🔇',()=>{image.muted=!image.muted;sound.textContent=image.muted?'🔇':'🔊';sound.setAttribute('aria-label',image.muted?'Включить звук':'Выключить звук');},'rs-view-control rs-sound');sound.setAttribute('aria-label','Включить звук');foot.append(sound);}
   if(user.id===s.author_id)foot.append(btn('Удалить',()=>removeStory(s,()=>d.close()),'rs-view-control'));
   else if(s.status==='published')foot.append(btn('Пожаловаться',()=>{held=true;image.pause?.();report(s);},'rs-view-control'));
   foot.append(storyNavigation(d));d.replaceChildren(image,loader,error,bar,head,prev,next,foot);close.focus();
   let touch=null;d.onpointerdown=e=>{if(e.target.closest('button,a,input,textarea'))return;touch={x:e.clientX,y:e.clientY};held=true;image.pause?.();};d.onpointerup=e=>{if(touch&&Math.abs(e.clientX-touch.x)>60&&Math.abs(e.clientX-touch.x)>Math.abs(e.clientY-touch.y))step(e.clientX<touch.x?1:-1);touch=null;resume();};d.onpointercancel=()=>{touch=null;resume();};d.onpointerleave=()=>{touch=null;resume();};
   d.onkeydown=e=>{if(e.target.closest('button,a'))return;if(e.key===' '){e.preventDefault();held=true;image.pause?.();}else if(e.key==='ArrowRight'){e.preventDefault();step(1);}else if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}};d.onkeyup=e=>{if(e.key===' '){e.preventDefault();resume();}};
   visibility=()=>{if(document.hidden){held=true;image.pause?.();}else resume();};document.addEventListener('visibilitychange',visibility);
   try{const url=await photo(s);if(!alive||!d.open||seq!==frame)return;
    if(isVideo){await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Video unavailable')),20000);image.onloadeddata=()=>{clearTimeout(timeout);resolve();};image.onerror=()=>{clearTimeout(timeout);reject(Error('Video unavailable'));};image.src=url;});if(!alive||!d.open||seq!==frame)return;image.classList.toggle('rs-round-video',image.videoWidth===image.videoHeight);}
    else {image.src=url;await image.decode();}
    if(!alive||!d.open||seq!==frame)return;loaded=true;loader.remove();if(isVideo&&!held)await image.play().catch(()=>{error.replaceChildren(btn('▶',()=>{error.replaceChildren();void image.play().catch(()=>{error.textContent='Не удалось воспроизвести историю.';});},'rs-view-control'));error.firstChild.setAttribute('aria-label','Воспроизвести историю');});
   }catch{if(d.open&&seq===frame){loader.remove();error.replaceChildren(el('p','','Не удалось загрузить историю.'),btn('Повторить',()=>{const path=storyPath(s),cached=urls.get(path);if(cached)URL.revokeObjectURL(cached);urls.delete(path);void show();}));}return;}
   last=performance.now();timer=setInterval(()=>{if(s.author_id!==user?.id&&Date.parse(s.expires_at)<=Date.now()){d.close();return;}const t=performance.now(),delta=Math.min(t-last,250);last=t;if(held||document.hidden||dialogs.size>1)return;const duration=isVideo?(Number.isFinite(image.duration)?image.duration*1000:30000):7000;if(isVideo){if(image.paused&&!image.ended)return;elapsed=image.currentTime*1000;}else elapsed+=delta;bar.children[index].firstChild.style.width=Math.min(100,elapsed/duration*100)+'%';if(elapsed>=duration||(isVideo&&image.ended))step(1);},100);
  }
  void show();
 }
 function compose(startCamera=false){
  if(!user){signIn();return;}const stamp=generation,d=modal('Добавить историю'),form=el('form','rs-compose rs-compose-editor'),editorRoot=el('div'),caption=el('textarea'),error=el('p','rs-error');caption.maxLength=200;caption.rows=2;
  const cl=el('label','rs-field','Подпись');cl.append(caption);error.setAttribute('role','alert');let draft=null,encoded=null,uploaded=false,sent=false;
  const editor=mountStoryEditor(editorRoot,{videoEnabled,onChange:()=>{encoded=null;}});
  const send=el('button','rs-button rs-gold',immediate?'Опубликовать историю':'Отправить на модерацию');send.type='submit';const cancel=btn('Отмена',()=>d.close());
  form.append(storyNavigation(d),el('h2','','Ваша история'),el('p','rs-note',immediate?'Историю увидят жители вашего города. До 5 историй за сутки.':'История появится после проверки городской командой. До 5 историй за сутки.'),editorRoot,cl,error,send,cancel);d.append(form);if(startCamera)editor.openCamera();
  d.addEventListener('close',()=>{editor.dispose();if(draft&&!sent)void call('remove_city_story',{p_id:draft.id}).then(()=>sb.storage.from('ryadom-stories').remove([storyPath(draft)])).catch(()=>{});},{once:true});
  form.onsubmit=async e=>{e.preventDefault();if(send.disabled)return;error.textContent='';send.disabled=true;caption.disabled=true;
   try{if(!encoded)encoded=await editor.prepare();editor.lock(true);if(!alive||stamp!==generation||!d.open)return;
    if(!draft){const row=await call(encoded.mime==='image/webp'?'create_city_story':'create_city_video_story',encoded.mime==='image/webp'?{p_city:city}:{p_city:city,p_mime:encoded.mime});draft=Array.isArray(row)?row[0]:row;}
    if(!alive||stamp!==generation||!d.open){if(draft)void call('remove_city_story',{p_id:draft.id}).catch(()=>{});return;}
    if(!uploaded){const r=await sb.storage.from('ryadom-stories').upload(storyPath(draft),encoded.blob,{contentType:encoded.mime,cacheControl:'0',upsert:false});if(r.error){if(String(r.error.statusCode||r.error.status)!=='409')throw r.error;const check=await sb.storage.from('ryadom-stories').download(storyPath(draft));if(check.error)throw r.error;}uploaded=true;}
    if(!alive||stamp!==generation||!d.open)return;
    await call('submit_city_story',{p_id:draft.id,p_caption:caption.value.trim()});sent=true;d.close();message(immediate?'История опубликована.':'История отправлена на модерацию. Статус — в разделе «Мои истории».');
   }catch(e){error.textContent=/^[А-ЯЁа-яё]/.test(e.message||'')?e.message:friendly(e);}finally{send.disabled=false;caption.disabled=false;if(!draft){editor.lock(false);encoded=null;}}
  };
 }
 async function manage(mode){
  if(!user){signIn();return;}const stamp=generation,d=modal(mode==='mine'?'Мои истории':immediate?'Управление историями':'Модерация историй'),box=el('div','rs-management'),title=el('h2','',mode==='mine'?'Мои истории':'Истории · '+city),body=el('div'),error=el('p','rs-error');error.setAttribute('role','alert');box.append(title,btn('Закрыть',()=>d.close()),error,body);d.append(box);
  const nav=el('div','rs-management-tabs');if(mode!=='mine'){for(const [value,label] of (immediate?[['published','Опубликованные'],['reports','Жалобы']]:[['pending','На проверке'],['published','Опубликованные'],['reports','Жалобы']]))nav.append(btn(label,()=>void load(value)));box.insertBefore(nav,body);}
  async function load(tab){body.replaceChildren(el('p','rs-note','Загружаем…'));error.textContent='';try{
    let rows,reports=[];
    if(tab==='reports'){
     const r=await sb.from('city_story_reports').select('story_id,reason,created_at,city_stories!inner(city)').eq('city_stories.city',city).order('created_at',{ascending:false}).limit(50);if(r.error)throw r.error;reports=r.data||[];
     const ids=[...new Set(reports.map(x=>x.story_id))];if(ids.length){const r=await sb.from('city_stories').select('*').eq('city',city).in('id',ids);if(r.error)throw r.error;rows=r.data||[];}else rows=[];
    }else{let q=sb.from('city_stories').select('*').eq('city',city).order('created_at',{ascending:false}).limit(50);q=tab==='mine'?q.eq('author_id',user.id).in('status',['published','pending','rejected']):q.eq('status',tab);const r=await q;if(r.error)throw r.error;rows=r.data||[];}
    if(!alive||stamp!==generation||!d.open)return;body.replaceChildren();if(!rows.length)body.append(el('p','rs-note','Здесь пока нет историй.'));
    for(const row of rows){const entry=el('article','rs-management-row');entry.append(el('strong','',row.author_label),el('p','',row.caption||'Без подписи'),el('small','',statusLabel(row)));if(row.review_reason)entry.append(el('p','rs-review-reason','Причина отказа: '+row.review_reason));for(const report of reports.filter(r=>r.story_id===row.id))entry.append(el('p','rs-report-reason','Жалоба: '+report.reason));if(row.status==='removed')continue;entry.append(btn('Открыть историю',()=>open(row,[row],()=>void load(tab))));if(row.author_id===user.id&&row.status!=='removed')entry.append(btn('Удалить',()=>removeStory(row,()=>void load(tab))));body.append(entry);}
   }catch(e){if(d.open){body.replaceChildren();error.textContent=friendly(e);}}
  }
  void load(mode==='mine'?'mine':immediate?'published':'pending');
 }
 async function refresh(){
  if(!alive||!available||dialogs.size||refreshing)return;refreshing=true;const stamp=++generation;disposeMedia(false);
  try{
   const session=await sb.auth.getSession();if(!alive||stamp!==generation)return;user=session.data?.session?.user||null;
   root.classList.add('rs-preview','rs-live-circles');const heading=el('div','rs-heading');heading.append(el('h2','','Истории рядом'));
   if(!user){root.hidden=false;root.style.removeProperty('display');root.replaceChildren(heading,btn('Войти, чтобы смотреть истории',signIn));lastRefresh=Date.now();return;}
   const [r,capabilities]=await Promise.all([sb.rpc('list_city_stories',{p_city:city}),sb.rpc('city_story_capabilities')]);if(!alive||stamp!==generation)return;if(r.error)throw r.error;items=r.data||[];videoEnabled=capabilities.data?.video===true;immediate=capabilities.data?.immediate_publish===true;
   const authorIds=[...new Set([user.id,...items.map(s=>s.author_id)])];const profiles=await sb.rpc('city_story_profiles',{p_ids:authorIds});if(!alive||stamp!==generation)return;avatars.clear();for(const profile of profiles.data||[])avatars.set(profile.id,profile.avatar_url);
   const actions=el('div','rs-live-actions');actions.append(btn('Мои истории',()=>void manage('mine')));
   const strip=el('div','rs-strip');strip.setAttribute('aria-label','Истории города '+city);const add=btn('',()=>compose(),'rs-card rs-add');add.setAttribute('aria-label','Добавить историю');add.append(el('span','rs-plus','+'));strip.append(add);for(const item of items)strip.append(card(item,()=>open(item)));
   root.hidden=false;root.style.removeProperty('display');root.replaceChildren(heading,actions,strip,note);lastRefresh=Date.now();
  }catch{if(alive&&stamp===generation){root.replaceChildren();root.hidden=true;root.style.display='none';}}finally{refreshing=false;if(alive&&stamp!==generation)queueMicrotask(()=>void refresh());}
 }
 function reset(){available=true;dirty=false;generation++;for(const d of dialogs){d.close();d.remove();}dialogs.clear();disposeMedia();root.replaceChildren();root.hidden=true;root.style.display='none';user=null;avatars.clear();note.textContent='';setTimeout(()=>void refresh(),0);}
 const auth=sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user?.id===user?.id)return;if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))reset();});
 const focus=()=>{if(Date.now()-lastRefresh>60000&&!root.contains(document.activeElement))void refresh();};window.addEventListener('focus',focus);interval=setInterval(()=>{if(!document.hidden&&(!root.contains(document.activeElement)||items.some(s=>Date.parse(s.expires_at)<=Date.now())))void refresh();},60000);void refresh();
 return ()=>{alive=false;generation++;clearInterval(interval);window.removeEventListener('focus',focus);auth.data.subscription.unsubscribe();for(const d of dialogs){d.close();d.remove();}dialogs.clear();disposeMedia();root.replaceChildren();root.hidden=false;root.style.removeProperty('display');};
}
