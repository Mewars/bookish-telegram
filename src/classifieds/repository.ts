import type { SupabaseClient } from '@supabase/supabase-js';

export type DealType = 'sell' | 'buy' | 'rent_out' | 'rent_in';
export type ListingStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'archived' | 'completed';
export const dealLabels: Record<DealType,string> = {
  sell:'Продам',buy:'Куплю',rent_out:'Сдам',rent_in:'Сниму',
};
export interface Classified {
  id:string; city:string; author_id:string; title:string; description:string;
  deal_type:DealType; category:string; district:string; price_rub:number|null;
  status:ListingStatus; created_at:string; updated_at:string;
}
export interface Conversation {
  id:string; listing_id:string; buyer_id:string; seller_id:string; created_at:string;
}
export interface ChatMessage {
  id:string; conversation_id:string; sender_id:string; body:string; created_at:string;
}
export interface Draft {
  city:string; title:string; description:string; category:string;
  deal_type:DealType; district:string; price_rub:number|null;
}

const FIELDS='id,city,author_id,title,description,deal_type,category,district,price_rub,status,created_at,updated_at';
const THREAD_FIELDS='id,listing_id,buyer_id,seller_id,created_at';
const MESSAGE_FIELDS='id,conversation_id,sender_id,body,created_at';
function db(client:SupabaseClient|null):SupabaseClient {
  if(!client) throw Error('Тестовая база объявлений не подключена.');
  return client;
}
function check(error:{message:string}|null):void {
  if(error) throw Error('Операция не выполнена. Проверьте вход и попробуйте снова.');
}
export function validateDraft(d:Draft):string|null {
  if(d.title.trim().length<5 || d.title.trim().length>140) return 'Название: от 5 до 140 символов.';
  if(d.description.trim().length<15 || d.description.trim().length>4000) return 'Описание: от 15 до 4000 символов.';
  if(d.category.trim().length<2 || d.category.trim().length>80) return 'Укажите категорию.';
  if(d.district.length>100) return 'Название района слишком длинное.';
  if(d.price_rub!==null && (!Number.isFinite(d.price_rub)||d.price_rub<0||d.price_rub>999999999.99)) return 'Проверьте цену.';
  return null;
}
export async function getPublished(client:SupabaseClient|null,city:string):Promise<Classified[]> {
  const {data,error}=await db(client).from('classifieds').select(FIELDS).eq('city',city)
    .in('status',['published','completed']).order('created_at',{ascending:false}).limit(100);
  check(error); return (data??[]) as Classified[];
}
export async function getMine(client:SupabaseClient|null,userId:string):Promise<Classified[]> {
  const {data,error}=await db(client).from('classifieds').select(FIELDS).eq('author_id',userId)
    .order('created_at',{ascending:false}).limit(100);
  check(error); return (data??[]) as Classified[];
}
export async function getPending(client:SupabaseClient|null,city:string):Promise<Classified[]> {
  const {data,error}=await db(client).from('classifieds').select(FIELDS).eq('city',city)
    .eq('status','pending').order('created_at',{ascending:true}).limit(100);
  check(error); return (data??[]) as Classified[];
}
export async function mayReview(client:SupabaseClient|null,city:string):Promise<boolean> {
  const {data,error}=await db(client).from('city_admin_access').select('city,role,active').eq('active',true);
  check(error);
  return (data??[]).some((item:{city:string;role:string})=>item.city===city || (item.city==='*'&&item.role==='owner'));
}
export async function createDraft(client:SupabaseClient|null,d:Draft):Promise<void> {
  const err=validateDraft(d);
  if(err) throw Error(err);
  const {error}=await db(client).from('classifieds').insert({
    city:d.city,title:d.title.trim(),description:d.description.trim(),
    category:d.category.trim(),district:d.district.trim(),deal_type:d.deal_type,price_rub:d.price_rub,
  });
  check(error);
}
export async function submitForReview(client:SupabaseClient|null,id:string,userId:string):Promise<void> {
  const {data,error}=await db(client).from('classifieds').update({status:'pending'})
    .eq('id',id).eq('author_id',userId).in('status',['draft','rejected'])
    .select('id').maybeSingle();
  check(error);
  if(!data) throw Error('Не удалось отправить объявление на проверку.');
}
export async function moderate(client:SupabaseClient|null,id:string,approved:boolean):Promise<void> {
  const {error}=await db(client).rpc('review_classified',{p_listing_id:id,p_approve:approved});
  check(error);
}
export async function markComplete(client:SupabaseClient|null,id:string):Promise<void> {
  const {error}=await db(client).rpc('complete_classified',{p_listing_id:id});
  check(error);
}
export async function getConversations(client:SupabaseClient|null,userId:string):Promise<Conversation[]> {
  const {data,error}=await db(client).from('classified_conversations').select(THREAD_FIELDS)
    .or('buyer_id.eq.'+userId+',seller_id.eq.'+userId)
    .order('created_at',{ascending:false}).limit(100);
  check(error);return (data??[]) as Conversation[];
}
export async function openConversation(client:SupabaseClient|null,listingId:string):Promise<string> {
  const {data,error}=await db(client).rpc('open_classified_conversation',{p_listing_id:listingId});
  check(error);
  if(typeof data!=='string') throw Error('Не удалось открыть переписку.');
  return data;
}
export async function getMessages(client:SupabaseClient|null,threadId:string):Promise<ChatMessage[]> {
  const {data,error}=await db(client).from('classified_messages').select(MESSAGE_FIELDS)
    .eq('conversation_id',threadId).order('created_at',{ascending:true}).limit(100);
  check(error);return (data??[]) as ChatMessage[];
}
export async function sendMessage(client:SupabaseClient|null,threadId:string,body:string):Promise<void> {
  if(body.trim().length<1 || body.trim().length>2000) throw Error('Сообщение должно быть от 1 до 2000 символов.');
  const {error}=await db(client).rpc('send_classified_message',{p_conversation_id:threadId,p_body:body.trim()});
  check(error);
}
