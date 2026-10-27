/* global location, sessionStorage, document, window, URL, URLSearchParams */
// A tab-local trail of public pages only. Never return a resident to an admin URL.
const KEY='ryadom.public.navigation.v1';
const PUBLIC=new Set(['home','places','events','services','friends','business','favorites','profile','add-organization','my-applications','privacy','cookies','terms','contacts']);
export function safePublicUrl(value,origin=location.origin){
 try{const u=new URL(value,origin);if(u.origin!==origin||u.username||u.password)return null;
 if(u.pathname==='/wall/'||u.pathname==='/classifieds/'){
  u.searchParams.delete('ryadom_embed');
  if(u.searchParams.has('view')||u.searchParams.has('access_token'))return null;
  return u.pathname+u.search;
 }
 if(u.pathname!=='/')return null;
 const [path,search='']=u.hash.replace(/^#\/?/,'').split('?'),parts=path.split('/');
 if(!PUBLIC.has(parts[0])||parts.length>2||parts[1]&&!['places','events','services'].includes(parts[0]))return null;
 const params=new URLSearchParams(search);if([...params.keys()].some(k=>/token|code|state/i.test(k)))return null;
 return '/'+u.hash;
 }catch{return null;}
}
function read(){try{const a=JSON.parse(sessionStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(x=>typeof x==='string'&&safePublicUrl(x)===x).slice(-30):[];}catch{return [];}}
function write(a){try{sessionStorage.setItem(KEY,JSON.stringify(a.slice(-30)));}catch{/* Navigation still falls back safely when storage is blocked. */}}
export function rememberPublicPage(){const current=safePublicUrl(location.href);if(!current)return;const a=read(),index=a.lastIndexOf(current);if(index>=0)write(a.slice(0,index+1));else {const identity=x=>x.split('?')[0];if(a.length&&identity(a.at(-1))===identity(current))a[a.length-1]=current;else a.push(current);write(a);}}
export function goPublicBack(fallback='/#/home'){
 const current=safePublicUrl(location.href),a=read();if(a.at(-1)===current)a.pop();
 const target=a.at(-1)||safePublicUrl(fallback)||'/#/home';write(a);if(window.top!==window.self){window.parent.postMessage({type:'RYADOM_SHELL_NAVIGATE',path:target},location.origin);return;}location.assign(target);
}
export function publicHome(){const u=new URL(location.href),hashParams=new URLSearchParams(u.hash.split('?')[1]||'');const selected=document.querySelector('#city');const city=u.searchParams.get('city')||hashParams.get('city')||(selected&&!selected.disabled&&!selected.value.startsWith('Загруз')?selected.value:'');return '/#/home'+(city?'?'+new URLSearchParams({city}):'');}
rememberPublicPage();window.addEventListener('hashchange',rememberPublicPage);window.addEventListener('popstate',rememberPublicPage);window.addEventListener('ryadom:route-change',rememberPublicPage);
// The independent wall/classifieds use the same safe navigation as the React app.
if(location.pathname==='/wall/'||location.pathname==='/classifieds/'){
 const main=document.querySelector('main');if(main){const nav=document.createElement('nav');nav.className='ryadom-page-navigation';nav.setAttribute('aria-label','Навигация страницы');const back=document.createElement('button');back.type='button';back.textContent='← Назад';back.onclick=()=>goPublicBack(publicHome());const home=document.createElement('a');home.textContent='На главную';home.href=publicHome();home.addEventListener('click',()=>{home.href=publicHome();});nav.append(back,home);main.prepend(nav);}
}
