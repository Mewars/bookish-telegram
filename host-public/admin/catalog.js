import {readManagedOrganizations} from '/catalog/adminData.js?v=20261021orgs1';
import {catalogGroups,matchesParent,matchesLeaf,catalogCounts,foodSubcategories,foodSubcategory,isFoodCategory,savedFoodCategory} from '/catalog/taxonomy.js?v=20261021orgs1';
/* РЯДОМ: те же категории в кабинете администратора, что и на главной.
 * Старая административная сетка остаётся доступной как запасной вариант.
 */
import {c as createClient} from '/wall/supabase-client.js';
const sb=createClient('https://cptbmepnbzogqkfhflsg.supabase.co','sb_publishable_-LLEHXpg_rqIZ_vUdPnwTQ_0ajeVm37',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});
const data={groups:catalogGroups,items:[],cities:[],user:null,roles:[],loading:null,render:null,error:''};
let observerBusy=false,epoch=0;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const norm=t=>String(t||'').toLowerCase().replace(/ё/g,'е').trim();
const fitsParent=matchesParent;
const fitsLeaf=matchesLeaf;
const describe=items=>{const n=catalogCounts(items);return `${n.total} всего · ${n.published} опубликовано · ${n.unpublished} не опубликовано`};
function renderEditor(root,item,parent,onDone,roles){
 const owner=roles.some(r=>r.role==='owner'&&r.city==='*'&&r.active);
 if(!owner){const t=el('p','ryadm-note','Изменять эту карточку можно через основной редактор ниже.');root.append(t);return}
 const dialog=el('div','ryadm-edit-overlay');const panel=el('section','ryadm-edit-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Редактирование организации');
 const heading=el('h3','',`Редактировать: ${item.title}`);panel.append(heading);
 const specs=[['title','Название',160],['category','Категория',100],['description','Описание',2000],['address','Адрес',300]];
 const fields={};for(const [key,label,limit] of specs){const block=el('label','ryadm-field');block.append(el('span','',label));const input=el(key==='description'?'textarea':'input');input.value=item[key]||'';input.maxLength=limit;input.required=key!=='address';block.append(input);panel.append(block);fields[key]=input}
 if(isFoodCategory(item.category)){
  const label=el('label','ryadm-field');label.append(el('span','','Подкатегория общепита'));
  const select=el('select');select.setAttribute('aria-label','Подкатегория общепита');for(const sub of foodSubcategories){const option=el('option','',sub.name);option.value=sub.foodKey;select.append(option)}
  select.value=foodSubcategory(item)?.foodKey||'unclassified';
  select.onchange=()=>{fields.category.value=savedFoodCategory(select.value)};
  label.append(select);panel.append(label);
 }
 const actions=el('div','ryadm-actions');const cancel=el('button','','Отмена');const save=el('button','ryadm-primary','Сохранить');const result=el('p','ryadm-note');
 const dismiss=()=>{dialog.remove();document.removeEventListener('keydown',esc)};cancel.onclick=dismiss;dialog.onclick=e=>{if(e.target===dialog)dismiss()};
 save.onclick=async()=>{const changes={};for(const [key] of specs)changes[key]=fields[key].value.trim()||null;if(!changes.title||!changes.category||!changes.description){result.textContent='Название, категория и описание обязательны.';return}save.disabled=true;
  const {error}=await sb.rpc('owner_edit_organization',{p_id:item.id,p_changes:changes});if(error){result.textContent=error.message;save.disabled=false;return}Object.assign(item,changes);dismiss();onDone();window.dispatchEvent(new Event('ryadom:organizations-changed'))};
 actions.append(cancel,save);panel.append(actions,result);dialog.append(panel);document.body.append(dialog);
 cancel.focus();
 const esc=e=>{if(e.key==='Escape'){dismiss();document.removeEventListener('keydown',esc)}};document.addEventListener('keydown',esc);
}
async function load(){
 if(data.loading)return data.loading;
 const token=epoch;
 data.loading=(async()=>{
  const {data:userData,error:userError}=await sb.auth.getUser();
  if(userError)throw userError;
  const user=userData?.user||null;
  if(!user){if(token===epoch){data.user=null;data.roles=[];data.items=[]}return}
  const {data:roles,error:roleError}=await sb.from('city_admin_access').select('city,role,active').eq('user_id',user.id).eq('active',true);
  if(roleError)throw roleError;
  const allowed=(roles||[]).filter(role=>role.active&&['owner','editor'].includes(role.role));
  const owner=allowed.some(role=>role.role==='owner'&&role.city==='*');
  const cities=[...new Set(allowed.filter(role=>role.city!=='*').map(role=>role.city))];
  if(!owner&&!cities.length){if(token===epoch){data.user=user;data.roles=[];data.items=[]}return}
  const {data:cityRows,error:cityError}=await sb.from('city_directory').select('name').eq('active',true).order('name');
  if(cityError)throw cityError;
  const items=await readManagedOrganizations(sb,allowed);
  if(token!==epoch)return;
  data.user=user;data.roles=allowed;data.items=items;data.cities=(cityRows||[]).map(city=>city.name);data.error='';
 })().catch(error=>{if(token===epoch)data.error=error?.message||'Не удалось обновить каталог';console.warn('РЯДОМ: категории администратора:',data.error)}).finally(()=>{data.loading=null});
 return data.loading;
}
function mount(section){if(section.querySelector('.ryadm-interface'))return;
 const wrap=el('section','ryadm-interface');wrap.setAttribute('aria-label','Категории для администратора');
 const toolbar=el('div','ryadm-toolbar');const count=el('span','ryadm-note','Структура каталога «РЯДОМ»');const legacy=el('button','ryadm-switch','Старая сетка');legacy.type='button';legacy.onclick=()=>{section.classList.toggle('ryadm-show-legacy');legacy.textContent=section.classList.contains('ryadm-show-legacy')?'Скрыть старую сетку':'Старая сетка'};toolbar.append(count,legacy);
 const controls=el('div','ryadm-controls');const back=el('button','ryadm-back','← Разделы');back.hidden=true;
 const search=el('input','ryadm-search');search.type='search';search.placeholder='Поиск по каталогу…';search.setAttribute('aria-label','Поиск категорий');
 const citySelect=el('select','ryadm-city');citySelect.setAttribute('aria-label','Город организаций');
 const ownerRole=data.roles.some(r=>r.role==='owner'&&r.city==='*'&&r.active);
 const validCities=ownerRole?[...new Set(data.items.map(o=>o.city))]:[...new Set(data.roles.filter(r=>r.role==='editor'&&r.active).map(r=>r.city))];
 if(ownerRole)for(const city of data.cities)if(!validCities.includes(city))validCities.push(city);
 if(!validCities.length){wrap.append(el('p','ryadm-note','Города для управления не назначены.'));section.append(wrap);return}
 validCities.sort((a,b)=>a.localeCompare(b,'ru'));
 for(const cityName of validCities){const opt=el('option','',cityName);opt.value=cityName;citySelect.append(opt)}
 const statusSelect=el('select','ryadm-city');statusSelect.setAttribute('aria-label','Статус карточек категорий');
 for(const [value,label] of [['all','Все статусы'],['published','Опубликованные'],['unpublished','Неопубликованные']]){const option=el('option','',label);option.value=value;statusSelect.append(option)}
 const refresh=el('button','ryadm-back','Обновить');refresh.type='button';refresh.onclick=async()=>{refresh.disabled=true;try{await load();render()}finally{refresh.disabled=false}};
 controls.append(back,search,citySelect,statusSelect,refresh);
 const heading=el('h3','ryadm-title','Все разделы');const cards=el('div','ryadm-grid');const summary=el('p','ryadm-note');const results=el('div','ryadm-results');wrap.append(toolbar,controls,heading,summary,cards,results);
 section.append(wrap);
 let active=null,sub=null,query='',city=validCities[0];citySelect.value=city;citySelect.onchange=()=>{city=citySelect.value;render()};
 const render=()=>{
  cards.replaceChildren();results.replaceChildren();back.hidden=!active;
  heading.textContent= sub?sub.name:active?active.name:'Все разделы';
  const all=data.groups.flatMap(group=>group.items);
  const cityItems=data.items.filter(item=>item.city===city);
  count.textContent=city+' · '+describe(cityItems);
  if(data.error){summary.textContent='Не удалось обновить: '+data.error;summary.setAttribute('role','alert');return}
  summary.removeAttribute('role');
  const items=cityItems.filter(item=>statusSelect.value==='all'||(statusSelect.value==='published'?item.status==='published':item.status!=='published'));
  const isSpecial=p=>['Афиша','Объявления','Городская стена'].includes(p.name);
  const buildButton=(text,info,click)=>{const btn=el('button','ryadm-card');btn.type='button';btn.append(el('strong','',text));if(info)btn.append(el('small','',info));btn.addEventListener('click',click);cards.append(btn)};
  if(!active){
   const list=all.filter(p=>!query||norm(p.name+' '+p.description+' '+p.hint).includes(norm(query)));
   summary.textContent=`${list.length} разделов · Выберите раздел, чтобы увидеть подразделы и карточки.`;
   for(const p of list){const n=items.filter(o=>fitsParent(o,p));buildButton(p.name,isSpecial(p)?'Открыть раздел':describe(n),()=>{active=p;query='';search.value='';render()})}
   return;
  }
  if(sub?.subs?.length){
   summary.textContent=describe(items.filter(item=>fitsParent(item,active)&&fitsLeaf(item,sub,active)));
   for(const child of sub.subs)buildButton(child.name,describe(items.filter(item=>fitsParent(item,active)&&fitsLeaf(item,child,active))),()=>{sub=child;render()});
   return;
 }
 if(!sub){
    let subs=active.subs||[];
    if(query)subs=subs.filter(p=>norm(p.name+' '+(p.hint||'')).includes(norm(query)));
    summary.textContent=(active.description||'')+' · '+describe(items.filter(item=>fitsParent(item,active)));
    for(const x of subs)buildButton(x.name,describe(items.filter(item=>fitsParent(item,active)&&fitsLeaf(item,x,active))),()=>{sub=x;query='';search.value='';render()});
    const n=items.filter(o=>fitsParent(o,active));
    if(!isSpecial(active)&&n.length){const allBtn=el('button','ryadm-all','Все карточки раздела ('+n.length+')');allBtn.onclick=()=>renderList(n);results.append(allBtn)}
    if(isSpecial(active)){const urls={'Афиша':'/#/events','Объявления':'/classifieds/','Городская стена':'/wall/'};const a=el('a','ryadm-all','Открыть '+active.name);a.href=urls[active.name];results.append(a)}
    return;
  }
  let n=items.filter(o=>fitsParent(o,active)&&fitsLeaf(o,sub,active));
  if(query)n=n.filter(o=>norm(o.title+' '+o.address).includes(norm(query)));
  summary.textContent=describe(n)+(sub.hint?' · '+sub.hint:'');
  if(sub.info){results.append(el('p','ryadm-note','Подраздел создан без публикации сведений о военных объектах.'));return}
  renderList(n);
 };
 function renderList(items){results.replaceChildren();if(!items.length){results.append(el('p','ryadm-note','Пока нет организаций. Их можно добавить через основной редактор ниже.'));return}
  for(const item of items){const row=el('article','ryadm-result');const body=el('div');body.append(el('strong','',item.title),el('small','',`${item.category} · ${item.status==='published'?'Опубликовано':item.status==='draft'?'Черновик':'Архив'} · ${item.city}${item.address?' · '+item.address:''}`));
   const actions=el('div','ryadm-result-actions');const edit=el('button','ryadm-primary','✎ Редактировать');edit.onclick=()=>renderEditor(wrap,item,active,render,data.roles);actions.append(edit);row.append(body,actions);results.append(row)}
 }
 back.onclick=()=>{if(sub)sub=null;else active=null;query='';search.value='';render()};
 search.oninput=()=>{query=search.value;render()};statusSelect.onchange=render;data.render=render;render();
}
async function check(){const section=document.querySelector('section.admin-panel.admin-cms-categories');if(!section||section.querySelector('.ryadm-interface'))return;
 await load();if(!data.user||!data.roles.some(r=>r.active&&(r.role==='owner'||r.role==='editor'))||!data.groups)return;
 if(section.isConnected)mount(section);
}
const observer=new MutationObserver(()=>{if(observerBusy)return;observerBusy=true;requestAnimationFrame(()=>{observerBusy=false;void check()})});
observer.observe(document.getElementById('root')||document.body,{childList:true,subtree:true});void check();

async function refreshMounted(){
 if(!document.querySelector('section.admin-panel.admin-cms-categories'))return;
 await load();
 if(!data.user||!data.roles.length){document.querySelector('.ryadm-interface')?.remove();data.render=null;return}
 if(document.querySelector('.ryadm-interface'))data.render?.();else await check();
}
window.addEventListener('ryadom:organizations-changed',()=>void refreshMounted());
window.addEventListener('focus',()=>void refreshMounted());
setInterval(()=>{if(!document.hidden)void refreshMounted()},30000);
sb.auth.onAuthStateChange(event=>{
 if(['INITIAL_SESSION','TOKEN_REFRESHED'].includes(event))return;
 epoch++;document.querySelector('.ryadm-interface')?.remove();data.render=null;data.user=null;data.roles=[];data.items=[];
 const prior=data.loading;
 setTimeout(()=>{if(prior)void prior.finally(refreshMounted);else void refreshMounted()},0);
});
