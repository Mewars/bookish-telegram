import {requestCategoryGroups} from '/catalog/requestCategories.js?v=20261021requests1';
import {catalogGroups} from '/catalog/taxonomy.js?v=20261021requests1';
/* РЯДОМ · фирменная панель разделов и подразделов. Ни одного стороннего дизайна. */
(()=>{
'use strict';
if(window.top!==window.self)return;
 const iconPath={
  grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  food:'<path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v19M18 3c-2 3-3 6-3 11h5V3M18 14v8"/>',
  shop:'<path d="M3 9h18l-2-6H5L3 9Z"/><path d="M5 9v12h14V9M9 21v-7h6v7"/>',
  pickup:'<path d="m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10"/><path d="m7 5 9 4"/>',
  hotel:'<path d="M3 21V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v15M3 21h18M8 9h2m4 0h2M8 13h2m4 0h2M9 21v-4h6v4"/>',
  repair:'<path d="m15 5 4-2 2 4-3 3 1 5-4 4-5-1-4 4-3-3 4-4-1-5 4-4 5-1Z"/><path d="m9 15 6-6"/>',
  public:'<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-7h6v7M9 10h.01M15 10h.01"/>',
  bank:'<path d="M2 10h20L12 4 2 10ZM4 10v10m5-10v10m6-10v10m5-10v10M2 21h20"/>',
  medical:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
  beauty:'<path d="M6 3 18 21M18 3 6 21"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>',
  cars:'<path d="m5 12 2-7h10l2 7M4 12h16v8H4zM7 20v2m10-2v2M8 16h2m4 0h2"/>',
  museum:'<path d="m2 10 10-6 10 6M3 10h18M5 11v9m5-9v9m5-9v9m5-9v9M2 21h20"/>',
  nature:'<path d="m12 2-6 9h3l-5 7h16l-5-7h3l-6-9ZM12 18v4"/>',
  culture:'<path d="M4 3h16v18H4zM8 7h8m-8 4h8m-8 4h5"/>',
  sport:'<path d="M4 9v6m3-9v12m10-12v12m3-9v6M7 11h10v2H7z"/>',
  events:'<rect x="3" y="5" width="18" height="17" rx="2"/><path d="M7 3v5m10-5v5M3 11h18M8 15h3m2 0h3"/>',
  chats:'<path d="M21 11a8 8 0 0 1-8 8H5l2-4a8 8 0 1 1 14-4Z"/>',
  classifieds:'<path d="M4 6h16v15H4zM8 6V3h8v3M8 11h8m-8 4h5"/>',
  home:'<path d="m3 10 9-7 9 7v11H3V10Zm6 11v-7h6v7"/>',

  school:'<path d="M3 21h18M5 21V7l7-4 7 4v14M9 11h6M9 15h6m-4 6v-3h2v3"/>',
  book:'<path d="M4 4h8a4 4 0 0 1 4 4v13H8a4 4 0 0 0-4-4V4Zm12 3h4v14h-4"/>',
  shield:'<path d="m12 2 9 4v6c0 5-3.5 8-9 10-5.5-2-9-5-9-10V6l9-4Zm-3 10 2 2 4-4"/>',
  emergency:'<path d="M12 3 3 20h18L12 3Zm0 7v4m0 3h.01"/>',
  children:'<circle cx="9" cy="6" r="2"/><circle cx="17" cy="8" r="2"/><path d="M4 21v-7c0-4 10-4 10 0v7M14 21v-5c0-3 7-3 7 0v5"/>',
  mail:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="m3 7 9 7 9-7"/>',
  clinic:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 7v9M8 11h8"/>',
  park:'<path d="M12 3c-5 0-7 4-6 7-4 2-3 8 2 8h8c5 0 6-6 2-8 1-3-1-7-6-7Zm0 15v4"/>',
  pets:'<circle cx="8" cy="9" r="1.2"/><circle cx="13" cy="7" r="1.2"/><circle cx="18" cy="9" r="1.2"/><path d="M8 18c0-3 2-5 4-5s4 2 4 5c0 2-2 3-4 2-2 1-4 0-4-2Z"/>',
  gift:'<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M12 9v12M3 13h18M4 9h16M12 9c-7 0-7-8-3-7 2 0 3 4 3 7Zm0 0c7 0 7-8 3-7-2 0-3 4-3 7Z"/>',
  history:'<path d="M3 21h18M5 21V11l7-8 7 8v10M9 14h6m-3-3v6"/>'
 };
 const groups=catalogGroups;

const icon=(name)=>'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+(iconPath[name]||iconPath.grid)+'</svg>';
const normalize=s=>String(s||'').toLocaleLowerCase('ru').replaceAll('ё','е');
const allParents=groups.flatMap(x=>x.items);
let backdrop=null,drawer=null,prevFocus=null,priorOverflow='',activeParent=null,activeNested=null,activeInfo=null,searchInput=null,content=null,subHeader=null,mainHeading=null;
function makeButton(cls,text,fn){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.addEventListener('click',fn);return b}
function sectionCity(){const city=document.querySelector('.web-header .city-pill, .app-header .city-pill, .city-pill');return city?.textContent?.trim()?.replace(/^город[:\s—-]*/i,'').trim()||'Енисейск'}
function close(){
 if(!drawer)return;
 document.removeEventListener('keydown',onKey,true);
 drawer.remove();backdrop?.remove();drawer=backdrop=null;
 document.body.style.overflow=priorOverflow;document.body.classList.remove('ryadom-cat-open');
 if(prevFocus instanceof HTMLElement&&prevFocus.isConnected)prevFocus.focus({preventScroll:true});
 activeParent=activeNested=activeInfo=null;searchInput=content=subHeader=mainHeading=null;
}
function open(){
 if(drawer){searchInput?.focus();return}
 prevFocus=document.activeElement;priorOverflow=document.body.style.overflow;
 document.body.classList.add('ryadom-cat-open');
 backdrop=document.createElement('div');backdrop.className='ryadom-cat-backdrop';backdrop.addEventListener('click',close);
 drawer=document.createElement('aside');drawer.className='ryadom-cat-drawer';
 drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-labelledby','ryadom-cat-heading');
 const header=document.createElement('header');header.className='ryadom-cat-header';
 const topline=document.createElement('div');topline.className='ryadom-cat-topline';
 const kicker=document.createElement('span');kicker.className='ryadom-cat-kicker';kicker.textContent='РЯДОМ · '+sectionCity();
 const cross=makeButton('ryadom-cat-close','×',close);cross.setAttribute('aria-label','Закрыть разделы');topline.append(kicker,cross);
 const navLine=document.createElement('div');navLine.className='ryadom-cat-navline';
 const back=makeButton('ryadom-cat-back','← Все разделы',()=>{if(activeInfo){activeInfo=null}else if(activeNested){activeNested=null}else{activeParent=null}searchInput.value='';render();});back.id='ryadom-cat-back';
 mainHeading=document.createElement('h2');mainHeading.id='ryadom-cat-heading';mainHeading.textContent='Город под рукой';
 navLine.append(back,mainHeading);
 subHeader=document.createElement('p');subHeader.className='ryadom-cat-lead';
 const inputWrap=document.createElement('div');inputWrap.className='ryadom-cat-searchbox';inputWrap.innerHTML=icon('search');
 searchInput=document.createElement('input');searchInput.className='ryadom-cat-search';searchInput.type='search';searchInput.placeholder='Поиск по разделам и услугам';searchInput.setAttribute('aria-label','Поиск по разделам');inputWrap.append(searchInput);
 header.append(topline,navLine,subHeader,inputWrap);
 content=document.createElement('div');content.className='ryadom-cat-scroll';
 drawer.append(header,content);
 searchInput.addEventListener('input',render);
 searchInput.addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();const first=content.querySelector('[data-ryadom-result]');if(first){first.click()}else{const query=searchInput.value.trim();close();searchCatalog(query)}});
 document.body.append(backdrop,drawer);document.addEventListener('keydown',onKey,true);
 requestAnimationFrame(()=>{backdrop?.classList.add('is-open');drawer?.classList.add('is-open')});
 render();searchInput.focus();
}
function onKey(e){
 if(e.key==='Escape'){e.preventDefault();if((activeInfo||activeNested||activeParent)&&!(searchInput?.value)){if(activeInfo)activeInfo=null;else if(activeNested)activeNested=null;else activeParent=null;render()}else close();return}
 if(e.key==='Tab'&&drawer){
  const nodes=Array.from(drawer.querySelectorAll('button:not([hidden]),input:not([disabled])')).filter(x=>x.getClientRects().length);
  if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
}
function makeTile(parent){
 const b=makeButton('ryadom-cat-tile','',()=>{activeParent=parent;activeNested=activeInfo=null;searchInput.value='';render();const h=document.getElementById('ryadom-cat-heading');h?.focus?.({preventScroll:true})});
 b.dataset.ryadomResult='true'; b.setAttribute('aria-label','Раздел «'+parent.name+'», открыть подразделы');
 const i=document.createElement('span');i.className='ryadom-cat-icon';i.innerHTML=icon(parent.icon);
 const t=document.createElement('span');t.className='ryadom-cat-tile-label';t.textContent=parent.name;
 const arrow=document.createElement('span');arrow.className='ryadom-cat-tile-arrow';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
 b.append(i,t,arrow);return b;
}
function addSection(title,parents){
 const section=document.createElement('section');section.className='ryadom-cat-group';
 const h=document.createElement('h3');h.className='ryadom-cat-group-title';h.textContent=title;
 const grid=document.createElement('div');grid.className='ryadom-cat-grid';parents.forEach(p=>grid.append(makeTile(p)));
 section.append(h,grid);content.append(section);
}
function makeSub(sub,parent){
 const b=makeButton('ryadom-cat-sub','',()=>choose(sub,parent));b.dataset.ryadomResult='true';
 const title=document.createElement('span');title.className='ryadom-cat-sub-name';title.textContent=sub.name;
 const hint=document.createElement('small');hint.className='ryadom-cat-sub-hint';hint.textContent=sub.hint;
 const chevron=document.createElement('span');chevron.className='ryadom-cat-sub-chevron';chevron.textContent='↗';chevron.setAttribute('aria-hidden','true');
 b.append(title,hint,chevron);return b;
}
function note(text){const p=document.createElement('p');p.className='ryadom-cat-footnote';p.textContent=text;content.append(p)}
function render(){
 if(!content||!searchInput)return;
 content.replaceChildren();content.scrollTop=0;
 const query=normalize(searchInput.value.trim());const back=document.getElementById('ryadom-cat-back');
 back.hidden=!(activeParent||activeNested||activeInfo||query);
 if(query){
  mainHeading.textContent='Найденные разделы';subHeader.textContent='Выберите подраздел или перейдите к поиску организаций.';
  const found=[];
  for(const p of allParents){const nameMatches=normalize(p.name+' '+p.description).includes(query);
   if(nameMatches)found.push({type:'parent',parent:p});
   for(const s of p.subs){if(normalize(s.name+' '+s.hint).includes(query))found.push({type:'sub',parent:p,sub:s});for(const leaf of (s.subs||[])){if(normalize(leaf.name+' '+leaf.hint).includes(query))found.push({type:'sub',parent:p,sub:leaf})}}
  }
  const list=document.createElement('div');list.className='ryadom-cat-sub-list';
  found.slice(0,75).forEach(r=>{
   const tile=r.type==='parent'?makeTile(r.parent):makeSub(r.sub,r.parent);
   if(r.type==='sub'){const group=document.createElement('small');group.className='ryadom-cat-result-parent';group.textContent=r.parent.name;tile.prepend(group)}
   list.append(tile)
  });
  content.append(list);
  if(!found.length)note('Подраздел не найден. Можно выполнить обычный поиск по всему каталогу.');
  const button=makeButton('ryadom-cat-all','Искать «'+searchInput.value.trim().slice(0,60)+'» на сайте',()=>{const q=searchInput.value.trim();close();searchCatalog(q)});content.append(button);
 }else if(activeInfo){
  mainHeading.textContent='Информация';subHeader.textContent='Раздел «РЯДОМ»';
  const box=document.createElement('section');box.className='ryadom-cat-info';const badge=document.createElement('span');badge.className='ryadom-cat-info-symbol';badge.textContent='◇';const title=document.createElement('h3');title.textContent='Военные части';const detail=document.createElement('p');detail.textContent='Раздел предусмотрен в каталоге. Сведения об объектах и подразделениях здесь не публикуются.';box.append(badge,title,detail);content.append(box);
 }else if(activeNested){
  mainHeading.textContent=activeNested.name;subHeader.textContent=activeNested.hint;const list=document.createElement('div');list.className='ryadom-cat-sub-list';activeNested.subs.forEach(sub=>list.append(makeSub(sub,activeParent)));content.append(list);
 }else if(activeParent){
  mainHeading.textContent=activeParent.name;
  subHeader.textContent=activeParent.description;
  const b=makeButton('ryadom-cat-browse','⌕  Найти все в разделе «'+activeParent.name+'»',()=>choose(activeParent));
  if(activeParent.term){content.append(b)}
  const l=document.createElement('h3');l.className='ryadom-cat-group-title';l.textContent='Подразделы';content.append(l);
  const subList=document.createElement('div');subList.className='ryadom-cat-sub-list';
  activeParent.subs.forEach(sub=>subList.append(makeSub(sub,activeParent)));content.append(subList);
  note('Подразделы постепенно наполняются. Если пока нет организаций, их добавим по мере развития каталога.');
 }else{
  mainHeading.textContent='Город под рукой';subHeader.textContent='Выбирайте направление, затем — нужный подраздел.';
  for(const group of groups)addSection(group.title,group.items);
  const button=makeButton('ryadom-cat-all','Показать все места и услуги',()=>{close();searchCatalog('')});content.append(button);
  note(sectionCity()+' · Список пополняется');
 }
 mainHeading.setAttribute('tabindex','-1');
}
function choose(item,parent=activeParent){
 if(item.subs?.length){activeNested=item;activeInfo=null;searchInput.value='';render();return}
 if(item.info){activeInfo=item;activeNested=null;searchInput.value='';render();return}
 const city=sectionCity();close();
 if(item.foodKey||parent?.name==='Где поесть'||item.name==='Где поесть'){
  const params=new URLSearchParams({city,category:'Кафе'});
  if(item.foodKey)params.set('subcategory',item.name);
  location.hash='#/places?'+params.toString();return;
 }
 if(item.url){try{if(item.url.includes('wall'))localStorage.setItem('ryadom.wall.city',city);
  if(item.url.includes('classifieds'))localStorage.setItem('ryadom.classified.city',city)}catch{}
  if(typeof window.ryadomOpenSection==='function'&&window.ryadomOpenSection(item.url))return;
  location.assign(item.url);return;
 }
 if(item.section==='today'){
  const run=()=>{const b=Array.from(document.querySelectorAll('.city-home .quick-discovery button')).find(x=>x.textContent.trim()==='Сегодня');if(!b)return false;b.click();return true};
  if(run())return;const home=document.querySelector('.web-nav [data-section="home"],.bottom-nav [data-section="home"]');
  if(home instanceof HTMLElement)home.click();else location.hash='#/home';
  let n=0;const t=setInterval(()=>{if(run()||++n>25)clearInterval(t)},70);return;
 }
 if(item.section){const b=document.querySelector('.web-nav [data-section="'+item.section+'"],.bottom-nav [data-section="'+item.section+'"]');
  if(b instanceof HTMLElement)b.click();else location.hash='#/'+item.section;return;
 }
 const branch=requestCategoryGroups.find(group=>group.label===parent?.name);
 if(branch?.options.length){
  const params=new URLSearchParams({city,category:parent.catalogCategory||parent.name,subcategory:item.name});
  location.hash='#/'+branch.options[0].kind+'?'+params.toString();return;
 }
 searchCatalog(item.term||item.name);
}
function setReactInput(el,text){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
 if(setter)setter.call(el,text);else el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}))}
function searchCatalog(value){
 if(!value){const nav=document.querySelector('.web-nav [data-section="places"],.bottom-nav [data-section="places"]');if(nav)nav.click();else location.hash='#/places';return;}
 const run=()=>{const input=document.querySelector('.city-home .cover-search input[type="search"]');
  if(!(input instanceof HTMLInputElement))return false;
  setReactInput(input,value);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{const action=document.querySelector('.city-home .cover-search-action');
   if(action instanceof HTMLElement)action.click();else document.querySelector('#city-selections')?.scrollIntoView({behavior:'smooth',block:'start'})}));return true};
 if(run())return;
 const b=document.querySelector('.web-nav [data-section="home"],.bottom-nav [data-section="home"]');
 if(b instanceof HTMLElement)b.click();else location.hash='#/home';
 let tries=0;const t=setInterval(()=>{if(run()||++tries>30)clearInterval(t)},80);
}
function ensureTrigger(){const area=document.querySelector('.city-home .quick-discovery');if(!area)return;
 const existing=document.getElementById('ryadom-category-trigger');if(existing&&existing.previousElementSibling===area)return;
 existing?.remove();const b=makeButton('ryadom-cat-entry','',open);b.id='ryadom-category-trigger';
 b.setAttribute('aria-haspopup','dialog');b.innerHTML=icon('grid')+'<span>Все категории</span>';
 area.insertAdjacentElement('afterend',b);
}
let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;ensureTrigger()})});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
function start(){observer.observe(document.getElementById('root')||document.body,{childList:true,subtree:true});ensureTrigger()}
window.ryadomOpenCategories=open;
})();
