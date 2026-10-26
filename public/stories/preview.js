// Visual trial only: no API calls, persistence, public uploads or moderation bypass.
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const button=(label,action,cls='rs-button')=>{const b=node('button',cls,label);b.type='button';b.onclick=action;return b;};
export function mountStoriesPreview(root,{city='Енисейск',base='/'}={}){
 let disposed=false,own=null,current=0,timer=null,paused=false,elapsed=0,last=0,swipe=null;
 const urls=new Set(),dialogs=new Set();let viewer=null,opener=null;
 const demo=[['park','На прогулке','Красота рядом'],['coffee','Кофе и встречи','Время для небольшой паузы'],['culture','Детали города','Открывай город по-новому']].map(([image,title,caption])=>({title,caption,src:base+'brand/discovery/'+(city==='Енисейск'?'eniseysk-':'')+image+'.webp',demo:true}));
 const stories=()=>own?[own,...demo]:demo;
 root.classList.add('rs-preview');
 const heading=node('div','rs-heading');heading.append(node('h2','','Истории рядом'),node('span','rs-trial','Пробный просмотр'));
 const notice=node('p','rs-note','Пример оформления. Фото остаются в этой вкладке и не публикуются.');
 const strip=node('div','rs-strip');strip.setAttribute('aria-label','Истории города '+city);
 root.replaceChildren(heading,notice,strip);
 function dialog(label){const d=node('dialog','rs-dialog');d.setAttribute('aria-label',label);dialogs.add(d);document.body.append(d);return d;}
 function redraw(){
  if(disposed)return;
  const add=button('',compose,'rs-card rs-add');add.setAttribute('aria-label','Примерить свою историю');add.append(node('span','rs-plus','+'),node('strong','','Ваша история'),node('small','','Фото и подпись'));
  strip.replaceChildren(add);
  for(const [i,s] of stories().entries()){
   const b=button('',()=>open(i,b),'rs-card');b.setAttribute('aria-label','Открыть историю: '+s.title);
   const image=node('img');image.src=s.src;image.alt='';image.loading='lazy';image.onerror=()=>{image.remove();b.classList.add('rs-no-photo');};
   const label=node('span','rs-card-label');label.append(node('span','rs-avatar',s.demo?'Р':'Я'),node('strong','',s.title),node('small','',s.demo?'Пример':'Только у вас'));
   b.append(image,label);strip.append(b);
  }
 }
 function compose(){
  const previous=document.activeElement,d=dialog('Примерить свою историю');const form=node('form','rs-compose');
  const close=button('✕',()=>d.close(),'rs-close');close.setAttribute('aria-label','Закрыть создание истории');
  const title=node('h2','','Ваша история'),tip=node('p','rs-note','Выберите фото и добавьте подпись. Это пример: отправки на сайт и публикации нет.');
  const file=node('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.required=true;
  const fileLabel=node('label','rs-field','Фото · JPG, PNG или WebP, до 10 МБ');fileLabel.append(file);
  const caption=node('textarea');caption.maxLength=200;caption.rows=3;caption.placeholder='Что происходит рядом?';
  const captionLabel=node('label','rs-field','Подпись');captionLabel.append(caption);
  const error=node('p','rs-error');error.setAttribute('role','alert');
  const submit=node('button','rs-button rs-gold','Посмотреть свою историю');submit.type='submit';
  form.append(close,title,tip,fileLabel,captionLabel,error,submit);d.append(form);
  let pending=null;
  form.onsubmit=async e=>{
   e.preventDefault();if(submit.disabled)return;
   const f=file.files?.[0];error.textContent='';
   if(!f||!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>10*1024*1024){error.textContent='Выберите JPG, PNG или WebP размером до 10 МБ.';return;}
   submit.disabled=true;pending=URL.createObjectURL(f);urls.add(pending);
   try{
    const img=new Image();img.src=pending;await img.decode();
    if(disposed||!d.open){urls.delete(pending);URL.revokeObjectURL(pending);pending=null;return;}
    if(own){URL.revokeObjectURL(own.src);urls.delete(own.src);}
    own={title:'Ваша история',caption:caption.value.trim(),src:pending,demo:false};pending=null;d.close();redraw();open(0,strip.querySelector('.rs-card:nth-child(2)'));
   }catch{error.textContent='Не удалось открыть фотографию. Попробуйте другой файл.';if(pending){urls.delete(pending);URL.revokeObjectURL(pending);pending=null;}}
   finally{submit.disabled=false;}
  };
  d.addEventListener('click',e=>{if(e.target===d)d.close();});
  d.addEventListener('close',()=>{dialogs.delete(d);d.remove();if(previous?.isConnected)previous.focus();},{once:true});d.showModal();
 }
 function stop(){if(timer!==null)clearInterval(timer);timer=null;}
 function open(index,source){
  current=index;opener=source;viewer=dialog('Просмотр истории');viewer.classList.add('rs-viewer');
  viewer.addEventListener('close',()=>{stop();const d=viewer;viewer=null;if(d){dialogs.delete(d);d.remove();}if(opener?.isConnected)opener.focus();},{once:true});
  viewer.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;if(e.key==='ArrowRight'){e.preventDefault();step(1);}if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}});
  viewer.showModal();show();
 }
 function step(delta){const next=current+delta;if(next<0)return;if(next>=stories().length){viewer?.close();return;}current=next;show();}
 function show(){
  stop();if(!viewer)return;const all=stories(),s=all[current];if(!s){viewer.close();return;}
  const picture=node('img','rs-full-photo');picture.src=s.src;picture.alt=s.caption||s.title;
  const imageError=node('p','rs-image-error');imageError.setAttribute('role','status');
  picture.onerror=()=>{imageError.textContent='Фотография недоступна. Можно перейти к следующей истории.';paused=true;pause.textContent='▶ Продолжить';};
  const bar=node('div','rs-progress');bar.setAttribute('aria-hidden','true');
  for(let i=0;i<all.length;i++){const segment=node('span'),fill=node('i');if(i<current)fill.style.width='100%';segment.append(fill);bar.append(segment);}
  const head=node('div','rs-view-head');head.append(node('span','rs-avatar',s.demo?'Р':'Я'),node('div','',s.demo?'Пример истории · '+city:'Ваша история · только у вас'));
  const close=button('✕',()=>viewer?.close(),'rs-view-control');close.setAttribute('aria-label','Закрыть историю');head.append(close);
  const previous=button('‹',()=>step(-1),'rs-arrow rs-previous');previous.setAttribute('aria-label','Предыдущая история');previous.disabled=current===0;
  const next=button('›',()=>step(1),'rs-arrow rs-next');next.setAttribute('aria-label','Следующая история');
  paused=window.matchMedia('(prefers-reduced-motion: reduce)').matches;elapsed=0;
  const pause=button(paused?'▶ Продолжить':'Ⅱ Пауза',()=>{paused=!paused;pause.textContent=paused?'▶ Продолжить':'Ⅱ Пауза';},'rs-view-control');
  const foot=node('div','rs-view-foot');foot.append(node('p','rs-caption',s.caption),pause);
  if(!s.demo)foot.append(button('Убрать своё фото',()=>{const src=own.src;own=null;urls.delete(src);URL.revokeObjectURL(src);viewer?.close();redraw();},'rs-view-control'));
  viewer.replaceChildren(picture,imageError,bar,head,previous,next,foot);
  viewer.onpointerdown=e=>{swipe=e.clientX;};viewer.onpointerup=e=>{if(swipe!==null&&Math.abs(e.clientX-swipe)>60){e.preventDefault();step(e.clientX<swipe?1:-1);}swipe=null;};
  last=performance.now();timer=setInterval(()=>{const now=performance.now(),delta=Math.min(now-last,250);last=now;if(paused||document.hidden)return;elapsed+=delta;const fill=bar.children[current]?.firstElementChild;if(fill)fill.style.width=Math.min(100,elapsed/70)+'%';if(elapsed>=7000)step(1);},100);
  close.focus();
 }
 redraw();
 return ()=>{disposed=true;stop();for(const d of dialogs){d.close();d.remove();}dialogs.clear();for(const url of urls)URL.revokeObjectURL(url);urls.clear();root.replaceChildren();};
}
