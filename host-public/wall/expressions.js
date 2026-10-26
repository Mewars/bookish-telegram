// Own artwork, shared by the public wall and React previews. No user-supplied URLs.
const captions=['Привет!','Кофе рядом?','Вот это мороз!','Спасибо!','Класс!','Пока!','Обнимаю!','Ахаха!','Спокойной ночи','Доброе утро!','Красота рядом','Пойдём гулять!','Жду автобус','Ура!','Помогу!','Как дела?','Ого!','Извини','Договорились!','Я рядом','Чай будешь?','Дома лучше','За покупками','Открывай город!'];
export const WALL_STICKERS=Object.freeze(captions.map((label,index)=>Object.freeze({id:`sable-${String(index+1).padStart(2,'0')}`,label,src:`/wall/stickers/sable-${String(index+1).padStart(2,'0')}.webp`})));
export const EMOJI_GROUPS=Object.freeze([
 ['Улыбки','😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 🙃 😉 😍 🥰 😘 😎 🤩 🥳 😋 😛 😜 🤪 🤗 🤭 🤫 🤔 😐 😑 🙄 😏 😔 😞 😢 😭 😤 😡 🤯 😳 🥺 😱 😴 🤤 🤒 🤕 🥶 🥵 🤠 🫠 🫶'],
 ['Жесты и чувства','👍 👎 👏 🙌 🤝 👋 ✌️ 🤞 💪 🙏 🫂 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 💕 💞 💓 💖 💘 💝 💯 ✅ ❌ ❗ ❓ 💬 💭 🎉 🎊 ✨ 🔥'],
 ['Город и природа','🏠 🏡 🏘️ 🏫 🏥 🏛️ ⛪ 🚌 🚏 🚕 🚗 🚲 🚶 🌲 🌳 🍂 🍁 🌿 🌸 🌞 ☀️ 🌤️ ☁️ 🌧️ 🌈 ❄️ ☃️ 🌊 🐾 🐈 🐕 🐻 🦊 🐿️ 📍 🗺️ 📷 🎭 🎬 🎵 🎶'],
 ['Еда и занятия','☕ 🍵 🥤 🍰 🎂 🍪 🍫 🍕 🍔 🍟 🍣 🥗 🍎 🍓 🥐 🍞 🍽️ 🛍️ 🎁 🎈 ⚽ 🏒 🎿 ⛸️ 🎣 📚 💻 📱 ⏰ 🛠️ 🧹 🧸 🛏️ 💐 🌹 🏆 🎯 🚀']
].map(([label,items])=>Object.freeze({label,items:Object.freeze(items.split(' '))})));
const tokenPattern=/\[ryadom-sticker:(sable-\d{2})\]/g;
export function stickerToken(id){return WALL_STICKERS.some(sticker=>sticker.id===id)?`[ryadom-sticker:${id}]`:'';}
export function parseWallBody(value){
 const body=String(value??'');const parts=[];let offset=0,count=0;
 for(const match of body.matchAll(tokenPattern)){
  const sticker=WALL_STICKERS.find(item=>item.id===match[1]);
  if(!sticker||count>=3)continue;
  if(match.index>offset)parts.push({type:'text',text:body.slice(offset,match.index)});
  parts.push({type:'sticker',...sticker});offset=match.index+match[0].length;count++;
 }
 if(offset<body.length)parts.push({type:'text',text:body.slice(offset)});
 return parts;
}
export function wallBodyPreview(value){return parseWallBody(value).map(part=>part.type==='text'?part.text:` ${part.label} `).join('').trim();}
function stickerImage(sticker){const image=document.createElement('img');image.src=sticker.src;image.alt=sticker.label;image.width=256;image.height=256;image.loading='lazy';image.className='wall-sticker';return image;}
export function renderWallBody(value,className=''){
 const root=document.createElement('div');root.className=`wall-expression-body ${className}`;
 for(const part of parseWallBody(value)){
  if(part.type==='text')root.append(document.createTextNode(part.text));
  else root.append(stickerImage(part));
 }
 return root;
}
export function attachExpressionPicker(field){
 const max=field.maxLength>0?field.maxLength:5000,minimum=field.minLength,required=field.required;
 let selected=null;const first=parseWallBody(field.value).find(part=>part.type==='sticker');
 if(first){selected=first;field.value=field.value.replace(stickerToken(first.id),'').trimEnd();}
 const root=document.createElement('div');root.className='wall-expressions';
 const preview=document.createElement('div');preview.className='wall-expression-preview';
 const details=document.createElement('details');details.className='wall-expression-picker';
 const summary=document.createElement('summary');summary.textContent='😊 Эмодзи и стикеры';
 const panel=document.createElement('div');panel.className='wall-expression-panel';
 const tabs=document.createElement('div');tabs.className='wall-expression-tabs';
 const choices=document.createElement('div');choices.className='wall-expression-choices';
 const status=document.createElement('p');status.className='wall-expression-status';status.setAttribute('role','status');
 const value=()=>field.value+(selected?'\n'+stickerToken(selected.id):'');
 function sync(){
  preview.replaceChildren();
  field.required=selected?false:required;field.minLength=selected?0:minimum;
  field.maxLength=max-(selected?stickerToken(selected.id).length+1:0);
  if(selected){const remove=document.createElement('button');remove.type='button';remove.className='btn ghost small';remove.textContent='Убрать стикер';remove.onclick=()=>{selected=null;sync();field.dispatchEvent(new Event('input',{bubbles:true}));};preview.append(stickerImage(selected),remove);}
 }
 function notify(){sync();field.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='';}
 function show(kind){
  choices.replaceChildren();for(const tab of tabs.children)tab.setAttribute('aria-pressed',String(tab.dataset.kind===kind));
  if(kind==='stickers'){
   const label=document.createElement('p');label.className='wall-expression-caption';label.textContent='Соболь РЯДОМ · 24 стикера';choices.append(label);
   const grid=document.createElement('div');grid.className='wall-sticker-grid';
   for(const sticker of WALL_STICKERS){const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Стикер: ${sticker.label}`);button.title=sticker.label;button.append(stickerImage(sticker));button.onclick=()=>{
    if(field.value.length+stickerToken(sticker.id).length+1>max){status.textContent='Для стикера нужно немного сократить текст.';return;}
    selected=sticker;notify();details.open=false;summary.focus();
   };grid.append(button);}choices.append(grid);
  }else for(const group of EMOJI_GROUPS){
   const heading=document.createElement('p');heading.className='wall-expression-caption';heading.textContent=group.label;
   const grid=document.createElement('div');grid.className='wall-emoji-grid';
   for(const emoji of group.items){const button=document.createElement('button');button.type='button';button.textContent=emoji;button.setAttribute('aria-label',`Добавить ${emoji}`);button.onclick=()=>{
    const start=field.selectionStart??field.value.length,end=field.selectionEnd??start;
    if(value().length-(end-start)+emoji.length>max){status.textContent='Достигнут предел длины сообщения.';return;}
    field.setRangeText(emoji,start,end,'end');notify();field.focus();
   };grid.append(button);}choices.append(heading,grid);
  }
 }
 for(const [kind,label] of [['emoji','Эмодзи'],['stickers','Стикеры']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.kind=kind;button.onclick=()=>show(kind);tabs.append(button);}
 details.addEventListener('keydown',event=>{if(event.key==='Escape'){details.open=false;summary.focus();}});
 details.addEventListener('toggle',()=>{if(details.open&&!choices.childNodes.length)show('emoji');});
 panel.append(tabs,choices,status);details.append(summary,panel);root.append(preview,details);sync();
 return {element:root,value,clear(){selected=null;sync();}};
}
