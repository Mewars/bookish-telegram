import type { SupabaseClient } from '@supabase/supabase-js';
export interface HomeListing {id:string;city:string;status:string;title:string;category:string;price_rub:number|null;deal_type:string;image?:string}
export interface HomePost {id:string;city:string;status:string;title:string;body:string;post_type:string;created_at:string}
export interface HomeFeed {city:string;listings:HomeListing[];posts:HomePost[];listingsError:boolean;postsError:boolean}
export function emptyHomeFeed(city:string):HomeFeed{return {city,listings:[],posts:[],listingsError:false,postsError:false};}
// Explicit city + published filters also apply to owners: a homepage is public.
export async function loadHomeFeed(client:SupabaseClient|null,city:string,signal:AbortSignal,onUpdate?:(feed:HomeFeed)=>void):Promise<HomeFeed>{
 const result=emptyHomeFeed(city);if(!client||!city||signal.aborted)return result;
 const publishUpdate=()=>{if(!signal.aborted)onUpdate?.({...result,listings:result.listings.map(item=>({...item})),posts:[...result.posts]});};
 const [ads,posts]=await Promise.allSettled([
  Promise.resolve(client.from('classifieds').select('id,city,status,title,category,price_rub,deal_type').eq('city',city).eq('status','published').order('created_at',{ascending:false}).limit(4).abortSignal(signal)).then(response=>{
   if(signal.aborted)return response;
   if(response.error)result.listingsError=true;else result.listings=(response.data??[]).filter(x=>x.city===city&&x.status==='published').slice(0,4).map(x=>({...x})) as HomeListing[];
   publishUpdate();return response;
  },error=>{result.listingsError=true;publishUpdate();throw error;}),
  Promise.resolve(client.from('community_posts').select('id,city,status,title,body,post_type,created_at').eq('city',city).eq('status','published').order('created_at',{ascending:false}).limit(2).abortSignal(signal)).then(response=>{
   if(signal.aborted)return response;
   if(response.error)result.postsError=true;else result.posts=(response.data??[]).filter(x=>x.city===city&&x.status==='published').slice(0,2) as HomePost[];
   publishUpdate();return response;
  },error=>{result.postsError=true;publishUpdate();throw error;}),
 ]);
 if(signal.aborted)return emptyHomeFeed(city);
 if(ads.status==='fulfilled'&&!ads.value.error)result.listings=(ads.value.data??[]).filter(x=>x.city===city&&x.status==='published').slice(0,4).map(x=>({...x})) as HomeListing[];else result.listingsError=true;
 if(posts.status==='fulfilled'&&!posts.value.error)result.posts=(posts.value.data??[]).filter(x=>x.city===city&&x.status==='published').slice(0,2) as HomePost[];else result.postsError=true;
 if(!result.listings.length)return result;
 // Private Storage stays private. Sign only the first registered photo of each
 // already-published listing; a missing photo must not hide the listing itself.
 try{
  const {data,error}=await client.from('classified_photos').select('listing_id,object_path,slot').in('listing_id',result.listings.map(x=>x.id)).order('slot',{ascending:true}).limit(40).abortSignal(signal);
  if(error||signal.aborted)return result;
  await Promise.all(result.listings.map(async item=>{
   const photo=data?.find(p=>p.listing_id===item.id);if(!photo||!photo.object_path.startsWith(item.id+'/'))return;
   try{const {data:signed,error:signError}=await client.storage.from('ryadom-classified-photos').createSignedUrl(photo.object_path,600);if(!signError&&signed?.signedUrl)item.image=signed.signedUrl;}catch{/* branded fallback */}
  }));
 }catch{/* listing remains available without its photo */}
 return result;
}
export function hostSectionHref(section:'classifieds'|'wall',city:string,params:Record<string,string>={}):string{
 return '/'+section+'/?'+new URLSearchParams({city,...params}).toString();
}
export function homePrice(item:HomeListing):string{
 if(['give_away','accept_free','pet_give'].includes(item.deal_type))return 'Бесплатно';
 if(item.deal_type==='exchange')return 'Обмен';
 return item.price_rub===null?'По договорённости':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(item.price_rub);
}
