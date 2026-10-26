/* global window, Blob, fetch, crypto, structuredClone */
const ids={resident:'33333333-3333-4333-8333-333333333333',editor:'22222222-2222-4222-8222-222222222222',owner:'11111111-1111-4111-8111-111111111111'};
let actor='guest';const listeners=new Set(),files=new Map(),rows=[{id:crypto.randomUUID(),city:'Город А',author_id:ids.owner,author_label:'Открытая история',caption:'Фото города',status:'published',object_path:'fixture/visible.webp',created_at:new Date().toISOString(),published_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()}];
const user=()=>ids[actor]?{id:ids[actor]}:null;
const allowed=s=>s.author_id===user()?.id||actor==='owner'||(actor==='editor'&&s.city==='Город А')||s.status==='published'&&Date.parse(s.expires_at)>Date.now();
const staff=s=>actor==='owner'||(actor==='editor'&&s.city==='Город А');
export function setActor(value){actor=value;for(const f of listeners)f(value==='guest'?'SIGNED_OUT':'SIGNED_IN');}
export const client={
 auth:{async getSession(){return {data:{session:user()?{user:user()}:null}};},onAuthStateChange(f){listeners.add(f);return {data:{subscription:{unsubscribe(){listeners.delete(f);}}}};}},
 async rpc(name,p={}){let data=null,error=null;const s=rows.find(s=>s.id===p.p_id);try{
  if(name==='list_city_stories')data=rows.filter(s=>s.city===p.p_city&&s.status==='published'&&Date.parse(s.expires_at)>Date.now());
  else if(name==='create_city_story'){if(!user())throw Error('Story not authorized');const id=crypto.randomUUID();data={id,city:p.p_city,author_id:user().id,author_label:actor==='resident'?'Житель':'Команда',status:'draft',caption:'',object_path:user().id+'/'+id+'.webp',created_at:new Date().toISOString()};rows.push(data);}
  else if(name==='submit_city_story'){if(!s||s.author_id!==user()?.id)throw Error('Story not authorized');s.caption=p.p_caption;s.status='pending';}
  else if(name==='review_city_story'){if(!s||!staff(s))throw Error('Story not authorized');if(p.p_action==='approve'){s.status='published';s.published_at=new Date().toISOString();s.expires_at=new Date(Date.now()+86400000).toISOString();}else if(p.p_action==='reject'){s.status='rejected';s.review_reason=p.p_reason;}else s.status='removed';}
  else if(name==='remove_city_story'){if(!s||s.author_id!==user()?.id)throw Error('Story not authorized');s.status='removed';}
  else if(name==='report_city_story')window.storyReports=(window.storyReports||0)+1;
  else throw Error('Unknown RPC');
 }catch(e){error={message:e.message};}return {data:data?structuredClone(data):data,error};},
 from(table){let filters={},take=50;const q={select(){return q;},eq(k,v){filters[k]=v;return q;},in(k,v){filters[k]=v;return q;},order(){return q;},limit(n){take=n;return q;},then(resolve,reject){let data=[];if(table==='city_admin_access')data=actor==='owner'?[{city:'*',role:'owner'}]:actor==='editor'?[{city:'Город А',role:'editor'}]:[];else if(table==='city_stories')data=rows.filter(s=>allowed(s)&&Object.entries(filters).every(([k,v])=>Array.isArray(v)?v.includes(s[k]):s[k]===v));return Promise.resolve({data:structuredClone(data.slice(0,take)),error:null}).then(resolve,reject);}};return q;},
 storage:{from(){return {async download(path){if(files.has(path))return {data:files.get(path),error:null};if(path==='fixture/visible.webp')return {data:await (await fetch('/brand/discovery/park.webp')).blob(),error:null};return {data:null,error:{message:'Unavailable'}};},async upload(path,blob){files.set(path,new Blob([blob],{type:'image/webp'}));window.storyUploads=(window.storyUploads||0)+1;return {data:{path},error:null};},async remove(paths){for(const p of paths)files.delete(p);return {data:[],error:null};}};}}
};
