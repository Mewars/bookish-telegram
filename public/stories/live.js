// Private Storage and server moderation. Missing schema hides the feature until approved.
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const btn=(label,action,cls='rs-button')=>{const b=el('button',cls,label);b.type='button';b.onclick=action;return b;};
const statusLabel=s=>({draft:'Черновик',pending:'На проверке',published:Date.parse(s.expires_at)>Date.now()?'Опубликована':'Срок показа истёк',rejected:'Отклонена',removed:'Удалена'}[s.status]||s.status);
const friendly=e=>{const m=String(e?.message||'');if(m.includes('daily limit'))return 'Можно предложить до 5 историй за 24 часа.';if(m.includes('self approval'))return 'Свою историю должен проверить другой модератор или владелец.';if(m.includes('not authorized'))return 'Недостаточно прав. Проверьте вход и выбранный город.';if(m.includes('photo missing'))return 'Фотография ещё не загружена. Попробуйте отправить снова.';if(m.includes('duplicate key'))return 'Жалоба на эту историю уже отправлена.';if(m.includes('report limit'))return 'Достигнут дневной лимит жалоб.';return 'Не удалось выполнить действие. Повторите попытку.';};
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
 let alive=true,available=true,dirty=false,generation=0,user=null,staff=false,owner=false,items=[],interval=null,observer=null;
 const dialogs=new Set(),urls=new Map(),pending=new Map();root.replaceChildren();root.hidden=true;root.style.display='none';
 const call=async(name,args)=>{const r=await sb.rpc(name,args);if(r.error)throw r.error;dirty=true;return r.data;};
 const note=el('p','rs-note');note.setAttribute('role','status');
 function message(t,error=false){if(!alive)return;note.textContent=t;note.classList.toggle('rs-error',error);}
 function modal(label){const d=el('dialog','rs-dialog');d.setAttribute('aria-label',label);dialogs.add(d);document.body.append(d);const previous=document.activeElement;
  d.addEventListener('close',()=>{dialogs.delete(d);d.remove();if(previous?.isConnected)previous.focus();if(!dialogs.size&&alive&&dirty){dirty=false;void refresh();}},{once:true});d.showModal();return d;
 }
 function disposeMedia(){observer?.disconnect();observer=null;for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();pending.clear();}
 async function photo(story){
  if(urls.has(story.object_path))return urls.get(story.object_path);
  if(pending.has(story.object_path))return pending.get(story.object_path);
  const stamp=generation;
  const request=(async()=>{const r=await sb.storage.from('ryadom-stories').download(story.object_path,{cacheNonce:String(Date.now())},{cache:'no-store'});if(r.error)throw r.error;if(!alive||stamp!==generation)throw Error('Stale story');const u=URL.createObjectURL(r.data);urls.set(story.object_path,u);return u;})();
  pending.set(story.object_path,request);try{return await request;}finally{if(pending.get(story.object_path)===request)pending.delete(story.object_path);}
 }
 function card(story,action){
  const b=btn('',action,'rs-card'),image=el('img');image.alt='';image.loading='lazy';image.onerror=()=>{image.remove();b.classList.add('rs-no-photo');b.title='Фото недоступно';};b.setAttribute('aria-label','История: '+story.author_label);
  const label=el('span','rs-card-label');label.append(el('span','rs-avatar',(story.author_label?.[0]||'Ж').toUpperCase()),el('strong','',story.author_label),el('small','',story.status==='published'?'24 часа':statusLabel(story)));
  b.append(image,label);
  const load=()=>photo(story).then(url=>{if(image.isConnected)image.src=url;}).catch(()=>{if(b.isConnected){image.remove();b.classList.add('rs-no-photo');b.title='Не удалось загрузить фото. Откройте историю, чтобы повторить.';}});
  if(observer)observer.observe(b);else queueMicrotask(load);b._loadStoryPhoto=load;return b;
 }
 function signIn(){const d=modal('Вход для публикации истории');const box=el('div','rs-compose');box.append(el('h2','','Ваша история'),el('p','rs-note','Войдите в аккаунт «РЯДОМ», чтобы предложить историю.'),btn('Закрыть',()=>d.close()));const a=el('a','rs-button rs-gold','Войти на сайт');a.href='/#/login';box.append(a);d.append(box);}
 function textForm(title,label,submitText,action){const d=modal(title),form=el('form','rs-compose'),field=el('textarea'),error=el('p','rs-error');field.required=true;field.minLength=3;field.maxLength=500;field.rows=4;const l=el('label','rs-field',label);l.append(field);error.setAttribute('role','alert');const send=el('button','rs-button rs-gold',submitText);send.type='submit';form.append(el('h2','',title),l,error,send,btn('Отмена',()=>d.close()));d.append(form);form.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{await action(field.value.trim());d.close();}catch(e){error.textContent=friendly(e);}finally{send.disabled=false;}};field.focus();}
 function report(story){if(!user){signIn();return;}textForm('Пожаловаться на историю','Причина жалобы','Отправить жалобу',async reason=>{await call('report_city_story',{p_id:story.id,p_reason:reason});message('Жалоба отправлена городской команде.');});}
 function removeStory(story,done){textForm('Удалить историю','Напишите «Удалить» для подтверждения','Удалить',async value=>{if(value.toLowerCase()!=='удалить')throw Error('Confirmation');await call('remove_city_story',{p_id:story.id});await sb.storage.from('ryadom-stories').remove([story.object_path]).catch(()=>{});done();message('История удалена из показа.');});}
 function open(story,list=items,moderation=false,onClose=null){
  const d=modal('Просмотр истории');const opener=document.activeElement;let index=list.findIndex(x=>x.id===story.id),timer=null,elapsed=0,last=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stop=()=>{if(timer)clearInterval(timer);timer=null;};let frame=0;
  d.classList.add('rs-viewer');d.addEventListener('close',()=>{stop();if(alive)onClose?.();if(opener?.isConnected)opener.focus();},{once:true});
  function step(delta){const next=index+delta;if(next<0)return;if(next>=list.length){d.close();return;}index=next;show();}
  async function show(){
   stop();const seq=++frame,s=list[index];if(!s){d.close();return;}elapsed=0;let approval=null;
   const image=el('img','rs-full-photo'),error=el('p','rs-image-error'),bar=el('div','rs-progress');image.alt=s.caption||'История '+s.author_label;error.textContent='Загружаем фото…';error.setAttribute('role','status');bar.setAttribute('aria-hidden','true');
   for(let i=0;i<list.length;i++){const segment=el('span'),fill=el('i');if(i<index)fill.style.width='100%';segment.append(fill);bar.append(segment);}
   const head=el('div','rs-view-head');head.append(el('span','rs-avatar',(s.author_label?.[0]||'Ж').toUpperCase()),el('span','',s.author_label+' · '+city));const close=btn('✕',()=>d.close(),'rs-view-control');close.setAttribute('aria-label','Закрыть историю');head.append(close);
   const prev=btn('‹',()=>step(-1),'rs-arrow rs-previous');prev.setAttribute('aria-label','Предыдущая история');prev.disabled=index===0;
   const next=btn('›',()=>step(1),'rs-arrow rs-next');next.setAttribute('aria-label','Следующая история');
   const foot=el('div','rs-view-foot');foot.append(el('p','rs-caption',s.caption));const pause=btn(paused?'▶ Продолжить':'Ⅱ Пауза',()=>{paused=!paused;pause.textContent=paused?'▶ Продолжить':'Ⅱ Пауза';},'rs-view-control');foot.append(pause);
   if(s.status!=='published'||moderation)foot.append(el('small','',statusLabel(s)));
   if(s.review_reason)foot.append(el('p','rs-review-reason','Причина отказа: '+s.review_reason));
   if(user?.id===s.author_id)foot.append(btn('Удалить историю',()=>{paused=true;removeStory(s,()=>d.close());},'rs-view-control'));
   else if(s.status==='published'&&!moderation)foot.append(btn('Пожаловаться',()=>{paused=true;report(s);},'rs-view-control'));
   if(moderation){
    if(s.status==='pending'){
     const approve=btn('Опубликовать',async()=>{approve.disabled=true;try{await call('review_city_story',{p_id:s.id,p_action:'approve',p_reason:null});d.close();message('История одобрена. Срок показа — 24 часа с этого момента.');}catch(e){error.textContent=friendly(e);approve.disabled=false;}},'rs-view-control');approval=approve;approve.disabled=true;foot.append(approve,btn('Отклонить',()=>textForm('Отклонить историю','Причина отказа','Отклонить',async reason=>{await call('review_city_story',{p_id:s.id,p_action:'reject',p_reason:reason});d.close();message('Автору будет видна причина отказа.');}),'rs-view-control'));
    }else if(s.status==='published')foot.append(btn('Скрыть историю',async()=>{try{await call('review_city_story',{p_id:s.id,p_action:'hide',p_reason:null});d.close();message('История скрыта.');}catch(e){error.textContent=friendly(e);}},'rs-view-control'));
   }
   d.replaceChildren(image,error,bar,head,prev,next,foot);close.focus();
   let touch=null;d.onpointerdown=e=>{touch=e.clientX;};d.onpointerup=e=>{if(touch!==null&&Math.abs(e.clientX-touch)>60)step(e.clientX<touch?1:-1);touch=null;};
   try{const url=await photo(s);if(!alive||!d.open||seq!==frame)return;image.src=url;await image.decode();if(!alive||!d.open||seq!==frame)return;error.textContent='';if(approval)approval.disabled=s.author_id===user?.id&&!owner;}catch{if(d.open&&seq===frame)error.textContent='Не удалось загрузить фото. Можно открыть историю заново.';return;}
   last=performance.now();timer=setInterval(()=>{if(!moderation&&s.status==='published'&&Date.parse(s.expires_at)<=Date.now()){d.close();return;}const t=performance.now(),delta=Math.min(t-last,250);last=t;if(paused||document.hidden||dialogs.size>1||moderation)return;elapsed+=delta;bar.children[index].firstChild.style.width=Math.min(100,elapsed/70)+'%';if(elapsed>=7000)step(1);},100);
  }
  d.addEventListener('keydown',e=>{if(dialogs.size>1)return;if(e.key==='ArrowRight'){e.preventDefault();step(1);}if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}});void show();
 }
 function compose(){
  if(!user){signIn();return;}const stamp=generation,d=modal('Добавить историю'),form=el('form','rs-compose'),file=el('input'),caption=el('textarea'),error=el('p','rs-error');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.required=true;caption.maxLength=200;caption.rows=3;
  const fl=el('label','rs-field','Фото · JPG, PNG или WebP, до 10 МБ');fl.append(file);const cl=el('label','rs-field','Подпись');cl.append(caption);error.setAttribute('role','alert');let draft=null,encoded=null,uploaded=false,sent=false;
  const send=el('button','rs-button rs-gold','Отправить на модерацию');send.type='submit';const cancel=btn('Отмена',()=>d.close());
  form.append(el('h2','','Ваша история'),el('p','rs-note','После одобрения городской командой история будет видна 24 часа. До проверки фото видите только вы и модератор. До 5 историй за 24 часа.'),fl,cl,error,send,cancel);d.append(form);
  d.addEventListener('close',()=>{if(draft&&!sent)void call('remove_city_story',{p_id:draft.id}).then(()=>sb.storage.from('ryadom-stories').remove([draft.object_path])).catch(()=>{});},{once:true});
  form.onsubmit=async e=>{e.preventDefault();if(send.disabled)return;error.textContent='';send.disabled=true;cancel.disabled=true;file.disabled=true;
   try{if(!encoded)encoded=await prepareStoryPhoto(file.files?.[0]);if(!alive||stamp!==generation||!d.open)return;
    if(!draft){const row=await call('create_city_story',{p_city:city});draft=Array.isArray(row)?row[0]:row;}
    if(!alive||stamp!==generation||!d.open)return;
    if(!uploaded){const r=await sb.storage.from('ryadom-stories').upload(draft.object_path,encoded,{contentType:'image/webp',cacheControl:'0',upsert:false});if(r.error){if(String(r.error.statusCode||r.error.status)!=='409')throw r.error;const check=await sb.storage.from('ryadom-stories').download(draft.object_path);if(check.error)throw r.error;}uploaded=true;}
    if(!alive||stamp!==generation||!d.open)return;
    await call('submit_city_story',{p_id:draft.id,p_caption:caption.value.trim()});sent=true;d.close();message('История отправлена на модерацию. Статус — в разделе «Мои истории».');
   }catch(e){error.textContent=/^[А-ЯЁа-яё]/.test(e.message||'')?e.message:friendly(e);}finally{send.disabled=false;cancel.disabled=false;if(!draft){file.disabled=false;encoded=null;}}
  };
 }
 async function manage(mode){
  if(!user){signIn();return;}const stamp=generation,d=modal(mode==='mine'?'Мои истории':'Модерация историй'),box=el('div','rs-management'),title=el('h2','',mode==='mine'?'Мои истории':'Истории · '+city),body=el('div'),error=el('p','rs-error');error.setAttribute('role','alert');box.append(title,btn('Закрыть',()=>d.close()),error,body);d.append(box);
  const nav=el('div','rs-management-tabs');if(mode!=='mine'){for(const [value,label] of [['pending','На проверке'],['published','Опубликованные'],['reports','Жалобы']])nav.append(btn(label,()=>void load(value)));box.insertBefore(nav,body);}
  async function load(tab){body.replaceChildren(el('p','rs-note','Загружаем…'));error.textContent='';try{
    let rows,reports=[];
    if(tab==='reports'){
     const r=await sb.from('city_story_reports').select('story_id,reason,created_at,city_stories!inner(city)').eq('city_stories.city',city).order('created_at',{ascending:false}).limit(50);if(r.error)throw r.error;reports=r.data||[];
     const ids=[...new Set(reports.map(x=>x.story_id))];if(ids.length){const r=await sb.from('city_stories').select('*').eq('city',city).in('id',ids);if(r.error)throw r.error;rows=r.data||[];}else rows=[];
    }else{let q=sb.from('city_stories').select('*').eq('city',city).order('created_at',{ascending:false}).limit(50);q=tab==='mine'?q.eq('author_id',user.id):q.eq('status',tab);const r=await q;if(r.error)throw r.error;rows=r.data||[];}
    if(!alive||stamp!==generation||!d.open)return;body.replaceChildren();if(!rows.length)body.append(el('p','rs-note','Здесь пока нет историй.'));
    for(const row of rows){const entry=el('article','rs-management-row');entry.append(el('strong','',row.author_label),el('p','',row.caption||'Без подписи'),el('small','',statusLabel(row)));if(row.review_reason)entry.append(el('p','rs-review-reason','Причина отказа: '+row.review_reason));for(const report of reports.filter(r=>r.story_id===row.id))entry.append(el('p','rs-report-reason','Жалоба: '+report.reason));entry.append(btn('Открыть историю',()=>open(row,[row],tab!=='mine',()=>void load(tab))));if(row.author_id===user.id&&row.status!=='removed')entry.append(btn('Удалить',()=>removeStory(row,()=>void load(tab))));body.append(entry);}
   }catch(e){if(d.open){body.replaceChildren();error.textContent=friendly(e);}}
  }
  void load(mode==='mine'?'mine':'pending');
 }
 async function refresh(){
  if(!alive||!available||dialogs.size)return;const stamp=++generation;disposeMedia();
  try{const r=await sb.rpc('list_city_stories',{p_city:city});if(!alive||stamp!==generation)return;if(r.error){if(['PGRST202','42883'].includes(r.error.code))available=false;root.replaceChildren();root.hidden=true;root.style.display='none';return;}items=r.data||[];
   const session=await sb.auth.getSession();if(!alive||stamp!==generation)return;user=session.data?.session?.user||null;staff=false;owner=false;
   if(user){const access=await sb.from('city_admin_access').select('city,role').eq('user_id',user.id).eq('active',true);if(!alive||stamp!==generation)return;owner=(access.data||[]).some(a=>a.city==='*'&&a.role==='owner');staff=owner||(access.data||[]).some(a=>a.city===city&&['owner','editor'].includes(a.role));}
   root.classList.add('rs-preview');const heading=el('div','rs-heading');heading.append(el('h2','','Истории рядом'),el('span','rs-live-label','24 часа'));
   const actions=el('div','rs-live-actions');if(user)actions.append(btn('Мои истории',()=>void manage('mine')));if(staff)actions.append(btn('Модерация историй',()=>void manage('pending')));
   const strip=el('div','rs-strip');strip.setAttribute('aria-label','Истории города '+city);
   if(typeof IntersectionObserver!=='undefined')observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);e.target._loadStoryPhoto?.();}},{rootMargin:'100px'});
   const add=btn('',compose,'rs-card rs-add');add.setAttribute('aria-label','Добавить историю');add.append(el('span','rs-plus','+'),el('strong','','Ваша история'),el('small','','Фото и подпись'));strip.append(add);for(const item of items)strip.append(card(item,()=>open(item)));
   root.hidden=false;root.style.removeProperty('display');root.replaceChildren(heading,actions,strip,note);if(!items.length&&!note.textContent)note.textContent='Поделитесь моментом из жизни города. Истории появляются после модерации.';
  }catch{if(alive&&stamp===generation){root.replaceChildren();root.hidden=true;root.style.display='none';}}
 }
 function reset(){available=true;dirty=false;generation++;for(const d of dialogs){d.close();d.remove();}dialogs.clear();disposeMedia();root.replaceChildren();root.hidden=true;root.style.display='none';user=null;staff=false;owner=false;note.textContent='';setTimeout(()=>void refresh(),0);}
 const auth=sb.auth.onAuthStateChange(event=>{if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))reset();});
 const focus=()=>{if(!root.contains(document.activeElement))void refresh();};window.addEventListener('focus',focus);interval=setInterval(()=>{if(!document.hidden&&!root.contains(document.activeElement))void refresh();},30000);void refresh();
 return ()=>{alive=false;generation++;clearInterval(interval);window.removeEventListener('focus',focus);auth.data.subscription.unsubscribe();for(const d of dialogs){d.close();d.remove();}dialogs.clear();disposeMedia();root.replaceChildren();root.hidden=false;root.style.removeProperty('display');};
}
