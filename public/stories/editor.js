// Native canvas/MediaRecorder editor. Everything stays on the device until Send.
const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;};
const button=(text,fn)=>{const n=el('button',text);n.type='button';n.className='rs-button';n.onclick=fn;return n;};
const field=(name,input)=>{input.setAttribute('aria-label',name);const l=el('label',name);l.className='rs-field';l.append(input);return l;};
export function recordingType(){return typeof MediaRecorder==='undefined'?'':['video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';}
export function mountStoryEditor(root,{videoEnabled=false,onChange=()=>{}}={}){
 const canvas=el('canvas');canvas.width=720;canvas.height=1280;canvas.className='rs-edit-canvas';canvas.setAttribute('aria-label','Предпросмотр истории');canvas.hidden=true;
 const ctx=canvas.getContext('2d'),file=el('input'),text=el('textarea'),color=el('input'),size=el('input'),layersSelect=el('select'),x=el('input'),y=el('input'),scale=el('input'),audio=el('input'),offset=el('input'),length=el('input'),volume=el('input'),original=el('input'),status=el('p'),cameraPreview=el('video');
 let alive=true,busy=false,revision=0,source=null,bitmap=null,sourceURL=null,sourceDuration=0,musicURL=null,camera=null,cameraRecorder=null,cameraTimer=null,renderTimer=null,active=0,layers=[],selectedAudio=null,prepared=null,abortExport=null,sourceRound=false,facing='user',opening=null,holding=false,cameraGeneration=0,keyboardHeld=false;
 const objectURLs=new Set();const url=blob=>{const u=URL.createObjectURL(blob);objectURLs.add(u);return u;};
 function revoke(u){if(u){URL.revokeObjectURL(u);objectURLs.delete(u);}}
 file.type='file';file.accept=videoEnabled?'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime':'image/jpeg,image/png,image/webp';
 text.maxLength=100;text.rows=2;color.type='color';color.value='#ffffff';size.type='range';size.min=24;size.max=90;size.value=48;
 for(const n of [x,y,scale,volume,original]){n.type='range';n.min=0;n.max=100;n.value=50;}scale.min=10;scale.max=250;scale.value=100;volume.value=65;original.value=100;
 audio.type='file';audio.accept='audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm';offset.type='number';offset.min=0;offset.max=3600;offset.value=0;length.type='number';length.min=3;length.max=30;length.value=7;
 status.className='rs-note';status.setAttribute('role','status');cameraPreview.playsInline=true;cameraPreview.muted=true;cameraPreview.autoplay=true;cameraPreview.hidden=true;cameraPreview.className='rs-camera-preview';
 const cameraStage=el('div');cameraStage.className='rs-camera-stage';const cameraViewport=el('div');cameraViewport.className='rs-camera-viewport';cameraViewport.append(cameraPreview);
 const cameraHint=el('p','Удерживайте кружок для записи · до 30 секунд');cameraHint.className='rs-capture-hint';
 const record=button('',()=>{});record.className='rs-shutter';record.setAttribute('aria-label','Удерживайте для записи истории');record.setAttribute('aria-pressed','false');record.append(el('span'));
 const flip=button('↻',async()=>{if(busy||holding||cameraRecorder?.state==='recording')return;facing=facing==='user'?'environment':'user';stopCamera();await openCamera();});flip.className='rs-flip';flip.setAttribute('aria-label','Переключить камеру');
 async function openCamera(){
  if(!videoEnabled||busy||camera)return;if(opening)return opening;
  const stamp=++cameraGeneration;
  opening=(async()=>{try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Камера недоступна. Можно выбрать готовый файл.');
   status.textContent='Ожидаем разрешение камеры и микрофона…';
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:720},height:{ideal:720},aspectRatio:{ideal:1}},audio:true});
   if(!alive||stamp!==cameraGeneration){stream.getTracks().forEach(t=>t.stop());return;}
   camera=stream;cameraViewport.hidden=false;cameraPreview.srcObject=stream;cameraPreview.hidden=false;cameraStage.classList.add('rs-camera-on');cameraPreview.classList.toggle('rs-mirrored',facing==='user');await cameraPreview.play();status.textContent='Удерживайте кружок, чтобы записать историю. Отпустите, чтобы закончить.';
  }catch(e){if(alive&&stamp===cameraGeneration){stopCamera();status.textContent=e.name==='NotAllowedError'?'Доступ к камере или микрофону не разрешён. Выберите готовое видео.':e.message;}}
  finally{if(stamp===cameraGeneration)opening=null;}})();return opening;
 }
 async function beginHold(){
  if(busy||holding)return;holding=true;
  await openCamera();if(!alive||!holding||!camera||busy)return;
  try{
   const mimeType=recordingType();if(!mimeType)throw Error('Этот браузер не поддерживает запись. Выберите готовое видео.');
   const chunks=[];let bytes=0;const recorder=new MediaRecorder(camera,{mimeType,videoBitsPerSecond:2500000,audioBitsPerSecond:128000});cameraRecorder=recorder;
   recorder.ondataavailable=e=>{chunks.push(e.data);bytes+=e.data.size;if(bytes>40*1024*1024)finishHold();};
   recorder.onerror=()=>{stopCamera();status.textContent='Не удалось записать видео. Попробуйте ещё раз.';};
   const started=performance.now();recorder.onstop=()=>{const duration=Math.min(30,(performance.now()-started)/1000),blob=new Blob(chunks,{type:mimeType.split(';')[0]});stopCamera();if(alive&&blob.size&&duration>=.3)void selectSource(new File([blob],'camera.'+(blob.type==='video/mp4'?'mp4':'webm'),{type:blob.type}),duration,true);else if(alive)status.textContent='Удерживайте кружок немного дольше, чтобы записать видео.';};
   recorder.start(250);record.classList.add('rs-recording');record.setAttribute('aria-pressed','true');flip.disabled=true;file.disabled=true;cameraHint.textContent='Идёт запись · отпустите кружок';cameraTimer=setTimeout(finishHold,30000);status.textContent='Идёт запись…';
  }catch(e){stopCamera();status.textContent=e.message;}
 }
 function finishHold(){holding=false;clearTimeout(cameraTimer);if(cameraRecorder?.state==='recording')cameraRecorder.stop();}
 record.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();record.setPointerCapture(e.pointerId);void beginHold();};
 record.onpointerup=record.onpointercancel=record.onlostpointercapture=finishHold;
 record.oncontextmenu=e=>e.preventDefault();
 record.onkeydown=e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();keyboardHeld=true;void beginHold();}};
 record.onkeyup=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();keyboardHeld=false;finishHold();}};
 record.onclick=e=>{if(e.detail===0&&!keyboardHeld){if(holding)finishHold();else void beginHold();}};
 function stopCamera(){cameraGeneration++;opening=null;holding=false;clearTimeout(cameraTimer);if(cameraRecorder?.state==='recording'){cameraRecorder.onstop=null;cameraRecorder.stop();}cameraRecorder=null;camera?.getTracks().forEach(t=>t.stop());camera=null;cameraPreview.pause();cameraPreview.srcObject=null;cameraPreview.hidden=true;cameraStage.classList.remove('rs-camera-on');record.classList.remove('rs-recording');record.setAttribute('aria-pressed','false');cameraHint.textContent='Удерживайте кружок для записи · до 30 секунд';flip.disabled=busy;file.disabled=busy;}
 function invalidate(){revision++;prepared=null;onChange();draw();}
 function controls(){layersSelect.replaceChildren();layers.forEach((l,i)=>{const o=el('option',l.kind==='text'?l.text:l.label);o.value=i;layersSelect.append(o);});active=Math.min(active,Math.max(0,layers.length-1));layersSelect.value=active;const l=layers[active];x.value=l?Math.round(l.x*100):50;y.value=l?Math.round(l.y*100):50;scale.value=l?l.scale*100:100;}
 function addLayer(l){if(layers.length>=12){status.textContent='В одной истории можно добавить до 12 надписей и стикеров.';return;}layers.push({...l,x:.5,y:.5,scale:1});active=layers.length-1;controls();invalidate();}
 const addText=button('Добавить надпись',()=>{if(text.value.trim())addLayer({kind:'text',text:text.value.trim(),color:color.value,size:Number(size.value)});});
 const choices=el('div');choices.className='rs-edit-stickers';choices.hidden=true;
 const stickerButton=button('Стикеры и эмодзи',async()=>{if(choices.childElementCount){choices.hidden=!choices.hidden;return;}try{const path='/wall/expressions.js?v=20261026b';const {WALL_STICKERS,EMOJI_GROUPS}=await import(/* @vite-ignore */path);if(!alive)return;for(const s of WALL_STICKERS){const b=button('',async()=>{try{const image=new Image();image.src=s.src;await image.decode();if(alive)addLayer({kind:'sticker',image,label:s.label});}catch{status.textContent='Стикер не загрузился.';}});b.setAttribute('aria-label',s.label);const image=el('img');image.src=s.src;image.alt=s.label;b.append(image);choices.append(b);}for(const group of EMOJI_GROUPS)for(const emoji of group.items)choices.append(button(emoji,()=>addLayer({kind:'text',text:emoji,color:'#ffffff',size:80})));choices.hidden=false;}catch{status.textContent='Стикеры временно недоступны.';}});
 layersSelect.onchange=()=>{active=Number(layersSelect.value);controls();};for(const n of [x,y,scale])n.oninput=()=>{const l=layers[active];if(l){l.x=Number(x.value)/100;l.y=Number(y.value)/100;l.scale=Number(scale.value)/100;invalidate();}};
 const remove=button('Убрать выбранный элемент',()=>{layers.splice(active,1);controls();invalidate();});
 let dragging=false;canvas.onpointerdown=e=>{if(busy||!layers[active])return;dragging=true;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!dragging)return;const rect=canvas.getBoundingClientRect(),l=layers[active];l.x=Math.max(.05,Math.min(.95,(e.clientX-rect.left)/rect.width));l.y=Math.max(.05,Math.min(.95,(e.clientY-rect.top)/rect.height));controls();invalidate();};canvas.onpointerup=canvas.onpointercancel=()=>{dragging=false;};
 function draw(){ctx.fillStyle='#071b29';ctx.fillRect(0,0,720,canvas.height);ctx.save();if(sourceRound){ctx.beginPath();ctx.arc(360,360,360,0,Math.PI*2);ctx.clip();}if(source){const w=source.videoWidth||source.width,h=source.videoHeight||source.height;if(w&&h){const ratio=Math.min(720/w,canvas.height/h);ctx.drawImage(source,(720-w*ratio)/2,(canvas.height-h*ratio)/2,w*ratio,h*ratio);}}for(const l of layers){ctx.save();ctx.translate(l.x*720,l.y*canvas.height);ctx.scale(l.scale,l.scale);if(l.kind==='sticker')ctx.drawImage(l.image,-100,-100,200,200);else{ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=l.color;ctx.font=`700 ${l.size}px system-ui,sans-serif`;ctx.lineJoin='round';ctx.strokeStyle='#07131dbb';ctx.lineWidth=6;const lines=l.text.split('\n').slice(0,5);lines.forEach((line,i)=>{const dy=(i-(lines.length-1)/2)*l.size*1.25;ctx.strokeText(line,0,dy,650);ctx.fillText(line,0,dy,650);});}ctx.restore();}ctx.restore();}
 const sourceControls=el('div');sourceControls.className='rs-edit-actions';
 const play=button('Просмотреть видео',async()=>{if(source?.tagName==='VIDEO'){if(source.paused){try{source.currentTime=0;await source.play();clearInterval(renderTimer);renderTimer=setInterval(draw,40);play.textContent='Остановить просмотр';}catch{status.textContent='Не удалось воспроизвести видео.';}}else{source.pause();clearInterval(renderTimer);play.textContent='Просмотреть видео';}}});sourceControls.append(play);play.hidden=true;
 async function selectSource(f,knownDuration=0,round=false){
  if(!f||busy)return;stopCamera();const stamp=++revision;prepared=null;onChange();status.textContent='Подготавливаем…';
  try{if(!['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'].includes(f.type)||f.size>(f.type.startsWith('video/')?40:10)*1024*1024)throw Error('Фото — JPG, PNG или WebP до 10 МБ. Видео — MP4, WebM или MOV до 40 МБ.');if(f.type.startsWith('video/')&&!videoEnabled)throw Error('Видео ещё не включено.');
   let next,nextURL=null;if(f.type.startsWith('image/')){next=await createImageBitmap(f);if(next.width*next.height>40000000){next.close();throw Error('Слишком большое разрешение фото.');}}else{next=el('video');next.playsInline=true;next.preload='auto';nextURL=url(f);next.src=nextURL;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Не удалось прочитать видео.')),15000);next.onloadeddata=()=>{clearTimeout(timer);resolve();};next.onerror=()=>{clearTimeout(timer);reject(Error('Этот формат видео не воспроизводится. Выберите MP4.'));};});if(!(knownDuration>0)&&(!Number.isFinite(next.duration)||next.duration<=0||next.duration>30.5)){next.removeAttribute('src');next.load();revoke(nextURL);throw Error('Выберите видео длительностью до 30 секунд.');}}
   if(!alive||stamp!==revision){next.close?.();if(next.tagName==='VIDEO'){next.pause();next.removeAttribute('src');next.load();}revoke(nextURL);return;}source?.pause?.();bitmap?.close();clearInterval(renderTimer);revoke(sourceURL);bitmap=f.type.startsWith('image/')?next:null;source=next;sourceRound=round;canvas.height=round?720:1280;canvas.classList.toggle('rs-round-canvas',round);canvas.hidden=false;cameraViewport.hidden=!round;if(round)cameraViewport.append(canvas);else root.insertBefore(canvas,sourceControls);sourceDuration=knownDuration||next.duration||0;sourceURL=nextURL;play.hidden=!!bitmap;layers=[];controls();draw();status.textContent=bitmap?'Фото готово. Добавьте надпись или стикеры.':'Видео готово. Добавьте надпись или стикеры.';
  }catch(e){if(alive&&stamp===revision)status.textContent=e.message;}
 }
 file.onchange=()=>void selectSource(file.files?.[0]);
 audio.onchange=()=>{const f=audio.files?.[0];selectedAudio=null;revoke(musicURL);musicURL=null;if(f){if(!f.type.startsWith('audio/')||f.size>20*1024*1024){audio.value='';status.textContent='Выберите аудиофайл до 20 МБ.';}else{selectedAudio=f;musicURL=url(f);}}invalidate();};
 for(const n of [offset,length,volume,original])n.oninput=invalidate;
 const removeAudio=button('Убрать музыку',()=>{audio.value='';selectedAudio=null;revoke(musicURL);musicURL=null;invalidate();});
 const music=el('details'),musicTitle=el('summary','Музыка из файла');music.append(musicTitle,el('p','Выберите трек, который вы вправе публиковать. Каталог музыки ВК и Telegram не подключён.'),field('Аудиофайл · до 20 МБ',audio),field('Начало музыки · секунды',offset),field('Длительность фото с музыкой · 3–30 секунд',length),field('Громкость музыки',volume),field('Звук исходного видео',original),removeAudio);music.hidden=!videoEnabled;
 const overlay=el('details');overlay.append(el('summary','Надписи и стикеры'),field('Текст на истории',text),field('Цвет текста',color),field('Размер текста',size),addText,stickerButton,choices,field('Выбранный элемент',layersSelect),field('Положение по горизонтали',x),field('Положение по вертикали',y),field('Масштаб элемента',scale),remove);
 const cameraActions=el('div');cameraActions.className='rs-capture-controls';cameraActions.append(record,flip);
 cameraStage.append(cameraViewport,cameraActions,cameraHint);cameraStage.hidden=!videoEnabled;
 root.classList.add('rs-editor');root.append(cameraStage,field(videoEnabled?'Фото или видео · до 30 секунд':'Фото · JPG, PNG или WebP, до 10 МБ',file),canvas,sourceControls,overlay,music,status);
 function lock(value){busy=value;for(const n of root.querySelectorAll('input,textarea,select,button'))n.disabled=value;}
 async function prepare(){
  if(prepared)return prepared;if(!source)throw Error('Выберите фото или запишите видео.');stopCamera();clearInterval(renderTimer);source.pause?.();play.textContent='Просмотреть видео';lock(true);const stamp=revision;
  try{const animated=source.tagName==='VIDEO'||selectedAudio;
   if(!animated){draw();const blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.85));if(!blob||blob.type!=='image/webp'||blob.size>2097152)throw Error('Не удалось подготовить фото.');return prepared={blob,mime:'image/webp'};}
   if(!videoEnabled||!recordingType()||!canvas.captureStream)throw Error('Этот браузер не поддерживает создание видео. Можно отправить фото без музыки.');
   const exportSource=source.tagName==='VIDEO'?source.cloneNode():source;if(exportSource!==source){exportSource.playsInline=true;exportSource.preload='auto';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Не удалось открыть видео.')),15000);exportSource.onloadeddata=()=>{clearTimeout(timer);resolve();};exportSource.onerror=()=>{clearTimeout(timer);reject(Error('Не удалось открыть видео.'));};exportSource.load();});}const originalSource=source;source=exportSource;const mimeType=recordingType(),stream=canvas.captureStream(25),chunks=[];let ac=null,musicAudio=null,recorder=null,total=0,timeout=null,ticker=null,hidden=null,finished=false;
   const cleanup=()=>{clearTimeout(timeout);clearInterval(ticker);if(hidden)document.removeEventListener('visibilitychange',hidden);abortExport=null;source?.pause?.();if(exportSource!==originalSource){exportSource.removeAttribute('src');exportSource.load();}source=originalSource;musicAudio?.pause();stream.getTracks().forEach(t=>t.stop());void ac?.close();};
   try{if(source.tagName==='VIDEO'||selectedAudio){ac=new AudioContext();await ac.resume();const destination=ac.createMediaStreamDestination();if(source.tagName==='VIDEO'){const gain=ac.createGain();gain.gain.value=Number(original.value)/100;ac.createMediaElementSource(source).connect(gain).connect(destination);}if(selectedAudio){musicAudio=el('audio');musicAudio.src=musicURL;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Не удалось прочитать музыку.')),15000);musicAudio.onloadedmetadata=()=>{clearTimeout(timer);resolve();};musicAudio.onerror=()=>{clearTimeout(timer);reject(Error('Не удалось прочитать музыку.'));};musicAudio.load();});const start=Number(offset.value);if(!Number.isFinite(start)||start<0||start>=musicAudio.duration)throw Error('Укажите начало внутри выбранного трека.');musicAudio.currentTime=start;const gain=ac.createGain();gain.gain.value=Number(volume.value)/100;ac.createMediaElementSource(musicAudio).connect(gain).connect(destination);}for(const t of destination.stream.getAudioTracks())stream.addTrack(t);}
    const duration=source.tagName==='VIDEO'?sourceDuration:Math.max(3,Math.min(30,Number(length.value)||7));
    const blob=await new Promise((resolve,reject)=>{const finish=(error)=>{if(finished)return;finished=true;if(recorder?.state==='recording')recorder.stop();if(error)reject(error);};abortExport=()=>finish(Error('Подготовка отменена.'));hidden=()=>{if(document.hidden)finish(Error('Подготовка остановлена: вернитесь на страницу и повторите отправку.'));};document.addEventListener('visibilitychange',hidden);
     recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:2500000,audioBitsPerSecond:128000});recorder.ondataavailable=e=>{chunks.push(e.data);total+=e.data.size;if(total>40*1024*1024)finish(Error('Видео превышает 40 МБ.'));};recorder.onerror=()=>finish(Error('Не удалось создать видео.'));recorder.onstop=()=>{if(!finished){finished=true;}resolve(new Blob(chunks,{type:mimeType.split(';')[0]}));};
     recorder.start(250);const start=performance.now();ticker=setInterval(()=>{draw();status.textContent='Готовим историю: '+Math.min(100,Math.floor((performance.now()-start)/(duration*10)))+'%. Оставьте страницу открытой.';},40);timeout=setTimeout(()=>finish(),duration*1000);
     if(source.tagName==='VIDEO'){source.currentTime=0;void source.play().catch(()=>finish(Error('Не удалось запустить видео.')));}if(musicAudio)void musicAudio.play().catch(()=>finish(Error('Не удалось запустить музыку.')));
    });
    if(!alive||stamp!==revision)throw Error('Подготовка отменена.');if(!blob.size||blob.size>40*1024*1024)throw Error('Видео не удалось подготовить.');return prepared={blob,mime:blob.type};
   }finally{cleanup();}
  }finally{if(alive)lock(false);}
 }
 const visibility=()=>{if(document.hidden&&camera){stopCamera();status.textContent='Камера выключена, поскольку страница скрыта. Можно открыть её снова.';}};document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',finishHold);
 function dispose(){document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',finishHold);alive=false;revision++;abortExport?.();stopCamera();clearInterval(renderTimer);source?.pause?.();if(source?.tagName==='VIDEO'){source.removeAttribute('src');source.load();}bitmap?.close();for(const u of objectURLs)URL.revokeObjectURL(u);objectURLs.clear();}
 draw();return {prepare,dispose,lock,openCamera};
}
