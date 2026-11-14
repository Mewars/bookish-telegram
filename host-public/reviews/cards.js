/* Встречай: public organization reviews, profile review history, owner administration. */
import {c as createClient} from '/wall/supabase-client.js';
const sb=createClient('https://cptbmepnbzogqkfhflsg.supabase.co',
'sb_publishable_-LLEHXpg_rqIZ_vUdPnwTQ_0ajeVm37',
{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});
let catalog=[],statistics=new Map(),currentUser=null,owner=false,initAuth=false;
let syncInProgress=false,scanQueued=false,detailOpenId=null;
const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru');
const node=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
const button=(label,fn,cls='ry-review-btn')=>{const b=node('button',cls,label);b.type='button';b.addEventListener('click',fn);return b};
const starline=n=>'★'.repeat(Math.max(0,Math.min(5,Number(n)||0)))+'☆'.repeat(Math.max(0,5-(Number(n)||0)));
function toast(text){let v=document.getElementById('ry-review-toast');if(!v){v=node('div','ry-review-toast');v.id='ry-review-toast';document.body.append(v)}v.textContent=text;v.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{v.hidden=true},5500)}
function cityName(){return norm(document.querySelector('.city-pill')?.textContent||'')}
function matchCard(card){
 const title=norm(card.querySelector('.card-title-button h3')?.textContent),kind=norm(card.dataset.kind),city=cityName();
 if(!title||!city||!kind)return null;
 let arr=catalog.filter(x=>norm(x.title)===title&&norm(x.kind)===kind&&norm(x.city)===city);
 if(arr.length>1){const category=norm(card.querySelector('.image-label')?.textContent);arr=arr.filter(x=>norm(x.category)===category)}
 return arr.length===1?arr[0]:null;
}
function matchDetail(detail){
 const title=norm(detail.querySelector('.detail-heading h1')?.textContent);if(!title)return null;
 const crumbs=norm(detail.querySelector('.detail-breadcrumb span')?.textContent);
 let arr=catalog.filter(x=>norm(x.title)===title);
 if(crumbs){arr=arr.filter(x=>crumbs.includes(norm(x.city))&&crumbs.includes(norm(x.category)))}
 return arr.length===1?arr[0]:null;
}
function statFor(id){return statistics.get(id)||{rating_avg:null,review_count:0,reviews_enabled:false}}
function countLabel(c){c=Number(c)||0;return c+' '+(c%10===1&&c%100!==11?'отзыв':c%10>=2&&c%10<=4&&(c%100<12||c%100>14)?'отзыва':'отзывов')}
function starRating(stat){const avg=Number(stat.rating_avg)||0,ct=Number(stat.review_count)||0;const p=node('span','ry-review-stars-large');
 p.textContent=ct?'★★★★★':'☆☆☆☆☆';if(ct){p.style.backgroundImage=`linear-gradient(to right,#ffc25c ${Math.min(100,avg*20)}%,#60717b ${Math.min(100,avg*20)}%)`;p.classList.add('ry-review-gradient')}return p}
function isReviewable(item){return !!statFor(item.id).reviews_enabled}
async function fetchStats(){if(!catalog.length)return;const {data,error}=await sb.rpc('organization_review_stats',{p_ids:catalog.slice(0,100).map(x=>x.id)});if(error)throw error;statistics=new Map((data||[]).map(x=>[x.organization_id,x]));scan()}
async function updateAuth(){const {data}=await sb.auth.getUser(),u=data?.user||null;if(initAuth&&u?.id===currentUser?.id)return;currentUser=u;owner=false;if(u){const {data:roles}=await sb.from('city_admin_access').select('city,role,active').eq('user_id',u.id).eq('active',true);owner=(roles||[]).some(x=>x.city==='*'&&x.role==='owner'&&x.active)}initAuth=true;scan()}
function dialog(title){const d=document.createElement('dialog');d.className='ry-review-dialog';const shell=node('div','ry-review-shell');const head=node('header','ry-review-header');head.append(node('h2','',title),button('×',()=>d.close(),'ry-review-close'));shell.append(head);d.append(shell);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.addEventListener('click',e=>{if(e.target===d)d.close()});d.showModal();return {d,shell}}
const dateFmt=x=>x?new Date(x).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'';
async function getReviews(orgId){const {data,error}=await sb.from('organization_reviews').select('id,organization_id,author_id,rating,body,status,created_at,updated_at').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(100);if(error)throw error;return data||[]}
async function getAuthorCards(orgId,reviews){const authorIds=[...new Set(reviews.filter(r=>r.status==='published').map(r=>r.author_id))];if(!authorIds.length)return new Map();const {data,error}=await sb.rpc('organization_public_review_authors',{p_organization_id:orgId,p_ids:authorIds.slice(0,100)});if(error)return new Map();return new Map((data||[]).map(x=>[x.author_id,x]))}
async function getBreakdown(orgId){const {data,error}=await sb.rpc('organization_review_breakdown',{p_ids:[orgId]});if(error)throw error;return data?.[0]||null}
function distribution(data){const container=node('section','ry-review-distribution');
 const total=Number(data?.total)||0,avg=data?.average_rating;
 const headline=node('div','ry-review-score');headline.append(node('strong','',total?Number(avg).toFixed(1).replace('.',','):'—'),starRating({rating_avg:avg,review_count:total}),node('span','',countLabel(total)));container.append(headline);
 if(total)container.append(node('p','ry-review-positive',`${Number(data.positive_percent)}% оценок — 4 или 5 звёзд`));
 for(let n=5;n>=1;n--){const count=Number(data?.['n'+n])||0,pct=total?Math.round(100*count/total):0;
 const line=node('div','ry-review-bar');line.append(node('span','',String(n)+' ★'));
 const track=node('div','ry-review-track'),fill=node('span','ry-review-fill');fill.style.width=pct+'%';track.append(fill);line.append(track,node('span','',`${pct}% (${count})`));container.append(line)}
 return container;
}
function buildReview(review,authorInfo,opts={}){const entry=node('article','ry-review-entry');const top=node('div','ry-review-entry-head');
 const avatar=node('div','ry-review-avatar');const safeAvatar=authorInfo?.avatar_url;
 if(safeAvatar){const img=document.createElement('img');img.loading='lazy';img.referrerPolicy='no-referrer';img.src=safeAvatar;img.alt='';avatar.append(img)}else avatar.textContent='👤';
 const meta=node('div','ry-review-meta');meta.append(node('strong','',review.author_id===currentUser?.id?'Вы':authorInfo?.display_name||'Житель города'),node('small','',dateFmt(review.updated_at||review.created_at)));
 const score=node('span','ry-review-entry-stars',starline(review.rating));top.append(avatar,meta,score);entry.append(top,node('p','ry-review-body',review.body));
 if(review.status!=='published')entry.append(node('small','ry-review-status',review.status==='pending'?'На проверке':review.status==='hidden'?'Удалён из публичного списка':'Не опубликован'));
 if(opts.owner&&review.status==='published'){
  const del=button('Удалить отзыв',async()=>{
   if(!confirm('Удалить этот отзыв без возможности восстановления? Он исчезнет из рейтинга.'))return;
   del.disabled=true;const {error}=await sb.rpc('owner_delete_organization_review',{p_review_id:review.id});
   if(error){del.disabled=false;toast('Не удалось удалить отзыв: '+error.message);return}
   entry.remove();await fetchStats();toast('Отзыв удалён');if(opts.onDeleted)opts.onDeleted();
  },'ry-review-delete');entry.append(del)
 }
 return entry;
}
async function fillReviews(container,item,opts={}){
 container.replaceChildren(node('p','ry-review-muted','Загружаем отзывы…'));
 try{
 const [reviews,dist]=await Promise.all([getReviews(item.id),getBreakdown(item.id)]);
 const published=reviews.filter(x=>x.status==='published'),auth=await getAuthorCards(item.id,published);
 const fragment=document.createDocumentFragment();fragment.append(distribution(dist));
 const link=button('Написать отзыв',()=>void openReviews(item),'ry-review-primary');fragment.append(link);
 const title=node('h3','', 'Отзывы посетителей');fragment.append(title);
 const shown=opts.preview?published.slice(0,3):published;
 if(!shown.length)fragment.append(node('p','ry-review-muted','Пока нет отзывов. Вы можете стать первым.'));
 for(const r of shown)fragment.append(buildReview(r,auth.get(r.author_id)));
 if(opts.preview&&published.length>3)fragment.append(button(`Читать все отзывы (${published.length})`,()=>void openReviews(item),'ry-review-link'));
 container.replaceChildren(fragment);
 }catch(e){container.replaceChildren(node('p','ry-review-muted','Не удалось загрузить отзывы: '+e.message))}
}
async function openReviews(item){const {d,shell}=dialog('Отзывы · '+item.title),content=node('div','ry-review-content');shell.append(content);
 await fillReviews(content,item);
 if(!d.open)return;
 if(!currentUser){shell.append(node('p','ry-review-muted','Чтобы оставить отзыв, войдите в профиль на сайте.'));return}
 const existing=await getReviews(item.id),mine=existing.find(x=>x.author_id===currentUser.id);
 const form=node('form','ry-review-form');form.append(node('h3','',mine?'Изменить свой отзыв':'Оставить отзыв'),node('p','ry-review-muted','Один отзыв на организацию. Он появится сразу после отправки.'));
 let rating=Number(mine?.rating)||5;const stars=node('div','ry-review-rate-row'),controls=[];
 for(let i=1;i<=5;i++){const n=i,b=button('★',e=>{e.stopPropagation();rating=n;refresh()},'ry-review-rate-star');b.setAttribute('aria-label',`${i} из 5`);stars.append(b);controls.push(b)}
 function refresh(){controls.forEach((b,k)=>{b.classList.toggle('selected',k<rating);b.setAttribute('aria-pressed',String(k+1===rating))})}refresh();form.append(stars);
 const text=document.createElement('textarea');text.rows=4;text.maxLength=1500;text.required=true;text.minLength=10;text.placeholder='Расскажите, что понравилось или что можно улучшить';text.value=mine?.body||'';
 const label=node('label','ry-review-label','Ваш отзыв');label.append(text);form.append(label);
 const send=button(mine?'Обновить отзыв':'Опубликовать отзыв',()=>{},'ry-review-primary');send.type='submit';form.append(send);
 form.addEventListener('submit',async e=>{e.preventDefault();send.disabled=true;
  try{const {error}=await sb.rpc('submit_organization_review',{p_organization_id:item.id,p_rating:rating,p_body:text.value.trim()});if(error)throw error;
  d.close();await fetchStats();toast('Отзыв опубликован');refreshActiveDetail(item.id);
  }catch(e){toast('Не получилось сохранить отзыв: '+e.message);send.disabled=false}
 });shell.append(form);
}
function reviewCardPanel(item){const s=statFor(item.id),p=node('div','ry-review-card-panel');p.dataset.reviewPanelId=item.id;
 const line=node('div','ry-review-rating-line');line.append(starRating(s),node('span','ry-review-summary',Number(s.review_count)?`${Number(s.rating_avg).toFixed(1).replace('.',',')} · ${countLabel(s.review_count)}`:'Пока нет оценок'));
 p.append(line);
 p.append(button('Отзывы',e=>{e.stopPropagation();e.preventDefault();openCardReviews(item)},'ry-review-link'));
 p.append(button('Написать отзыв',e=>{e.stopPropagation();e.preventDefault();void openReviews(item)},'ry-review-open'));
 return p;
}
function openCardReviews(item){const card=[...document.querySelectorAll('article.card.card-real')].find(x=>matchCard(x)?.id===item.id);const open=card?.querySelector('.card-title-button');if(!open){void openReviews(item);return}
 detailOpenId=item.id;open.click();setTimeout(()=>{const section=document.getElementById('ry-org-reviews');if(section)section.scrollIntoView({behavior:'smooth',block:'start'});else void openReviews(item)},450);
}
function scanCards(){for(const card of document.querySelectorAll('article.card.card-real')){
 const item=matchCard(card),old=card.querySelector(':scope .ry-review-card-panel');
 if(!item||!isReviewable(item)){old?.remove();continue}
 const s=statFor(item.id),key=[item.id,s.rating_avg,s.review_count].join('|');if(old?.dataset.key===key)continue;
 old?.remove();const panel=reviewCardPanel(item);panel.dataset.key=key;card.querySelector('.card-body')?.append(panel);
}}
function refreshActiveDetail(id){const detail=document.querySelector('article.guide-detail'),item=detail?matchDetail(detail):null;
 if(item&&item.id===id){const section=detail.querySelector('#ry-org-reviews .ry-review-detail-content');if(section)void fillReviews(section,item,{preview:true})}}
function scanDetail(){const detail=document.querySelector('article.guide-detail');if(!detail)return;
 const item=matchDetail(detail),old=detail.querySelector('#ry-org-reviews');if(!item||!isReviewable(item)){old?.remove();return}
 if(old?.dataset.orgId===item.id)return;old?.remove();
 const section=node('section','ry-review-detail');section.id='ry-org-reviews';section.dataset.orgId=item.id;
 section.append(node('h2','','Отзывы об организации'));const content=node('div','ry-review-detail-content');section.append(content);
 const main=detail.querySelector('.detail-place-main');if(main)main.append(section);else detail.append(section);
 const tabs=detail.querySelector('.detail-quick-tabs');if(tabs&&!tabs.querySelector('.ry-review-tab'))tabs.append(button('Отзывы',()=>section.scrollIntoView({behavior:'smooth',block:'start'}),'ry-review-tab'));
 void fillReviews(content,item,{preview:true});if(detailOpenId===item.id){detailOpenId=null;setTimeout(()=>section.scrollIntoView({behavior:'smooth',block:'start'}),90)}
}
function profileReviewWidget(){if(!document.querySelector('section.profile-card'))return;
 const soon=[...document.querySelectorAll('.profile-future .profile-row')].find(x=>x.querySelector('strong')?.textContent?.trim()==='Мои отзывы');
 if(soon&&!soon.dataset.ryReviews){soon.dataset.ryReviews='yes';soon.disabled=false;soon.querySelector('.row-count')?.replaceChildren(node('span','','Открыть'));soon.addEventListener('click',e=>{e.stopPropagation();void openMyReviews()})}
 if(owner){const future=document.querySelector('.profile-future');if(future&&!future.querySelector('.ry-review-owner-entry')){
 const b=button('Управление отзывами',()=>void openAdminReviews(),'profile-row ry-review-owner-entry');future.append(b)
 }}
}
async function openMyReviews(){const {d,shell}=dialog('Мои отзывы');if(!currentUser){shell.append(node('p','','Сначала войдите в аккаунт.'));return}
 const body=node('section','ry-review-list');shell.append(body);
 const {data,error}=await sb.from('organization_reviews').select('id,organization_id,author_id,rating,body,status,created_at,updated_at').eq('author_id',currentUser.id).order('updated_at',{ascending:false}).limit(100);
 if(!d.open)return;if(error){body.append(node('p','',error.message));return}
 if(!data?.length){body.append(node('p','','Вы ещё не оставляли отзывы.'));return}
 for(const r of data){const item=catalog.find(x=>x.id===r.organization_id);const e=node('article','ry-review-entry');
 e.append(node('strong','',item?.title||'Организация'),node('div','ry-review-entry-stars',starline(r.rating)),node('p','',r.body));
 if(item&&isReviewable(item))e.append(button('Открыть отзывы организации',()=>{d.close();openCardReviews(item)},'ry-review-link'));
 body.append(e)}
}
function adminReviewWidget(){if(!owner)return;const target=document.querySelector('.admin-panel');if(!target)return;
 if(document.querySelector('.ry-review-owner-toolbar'))return;
 const row=node('div','ry-review-owner-toolbar');row.append(button('⭐ Управление отзывами',()=>void openAdminReviews(),'ry-review-primary'));
 target.prepend(row)
}
async function openAdminReviews(){if(!owner){toast('Недоступно');return}
 const {d,shell}=dialog('Управление отзывами «Встречай»');const container=node('section','ry-review-list');shell.append(node('p','ry-review-muted','Только владелец платформы может удалить отзыв. Средний рейтинг пересчитается автоматически.'),container);
 async function reload(){container.replaceChildren(node('p','ry-review-muted','Загрузка…'));
 const {data,error}=await sb.from('organization_reviews').select('id,organization_id,author_id,rating,body,status,created_at,updated_at').order('created_at',{ascending:false}).limit(150);
 if(error){container.replaceChildren(node('p','',error.message));return}if(!d.open)return;
 const list=document.createDocumentFragment();if(!data?.length)list.append(node('p','','Пока нет отзывов.'));
 for(const r of data||[]){const item=catalog.find(x=>x.id===r.organization_id),section=node('section','ry-review-admin-row');
 section.append(node('h3','',`${item?.title||r.organization_id} · ${item?.city||''}`));
 section.append(buildReview(r,null,{owner:owner,onDeleted:()=>{void reload()}}));list.append(section)}
 container.replaceChildren(list)}
 await reload();
}
function scan(){if(syncInProgress)return;syncInProgress=true;try{scanCards();scanDetail();profileReviewWidget();adminReviewWidget()}finally{syncInProgress=false}}
function scheduleScan(){if(scanQueued)return;scanQueued=true;requestAnimationFrame(()=>{scanQueued=false;scan()})}
async function boot(){const style=document.createElement('link');style.rel='stylesheet';style.href='/reviews/cards.css?v=5';document.head.append(style);
 try{const {data,error}=await sb.from('organizations').select('id,kind,city,title,category').eq('status','published').limit(1000);if(error)throw error;catalog=data||[];
 await Promise.all([updateAuth(),fetchStats()]);}catch(e){console.warn('Встречай отзывы: не удалось загрузить',e)}
 const root=document.getElementById('root');if(root)new MutationObserver(scheduleScan).observe(root,{childList:true,subtree:true});
 addEventListener('hashchange',scheduleScan);sb.auth.onAuthStateChange(()=>setTimeout(()=>void updateAuth().catch(()=>{}),0));
 addEventListener('pageshow',()=>{void Promise.all([updateAuth(),fetchStats()]).catch(()=>{})});scan();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else void boot();
