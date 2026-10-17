import type { SupabaseClient } from '@supabase/supabase-js';

export type DealType = 'sell' | 'buy' | 'rent_out' | 'rent_in';
export type ListingStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'archived' | 'completed';
export const dealLabels: Record<DealType,string> = {
  sell:'Продам',buy:'Куплю',rent_out:'Сдам',rent_in:'Сниму',
};
export interface Classified {
  id:string; city:string; author_id:string; title:string; description:string;
  deal_type:DealType; category:string; district:string; price_rub:number|null;
  status:ListingStatus; created_at:string; updated_at:string; rejection_reason?:string|null;
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
  if(typeof d.city!=='string' || !d.city.trim()) return 'Выберите город.';
  if(typeof d.deal_type!=='string' || !Object.hasOwn(dealLabels,d.deal_type)) return 'Выберите тип объявления.';
  if(typeof d.title!=='string' || d.title.trim().length<5 || d.title.trim().length>140) return 'Название: от 5 до 140 символов.';
  if(typeof d.description!=='string' || d.description.trim().length<15 || d.description.trim().length>4000) return 'Описание: от 15 до 4000 символов.';
  if(typeof d.category!=='string' || d.category.trim().length<2 || d.category.trim().length>80) return 'Укажите категорию.';
  if(typeof d.district!=='string' || d.district.length>100) return 'Название района слишком длинное.';
  if(d.price_rub!==null && (!Number.isFinite(d.price_rub)||d.price_rub<0||d.price_rub>999999999.99)) return 'Проверьте цену.';
  return null;
}
export async function getPublished(client:SupabaseClient|null,city:string):Promise<Classified[]> {
  const {data,error}=await db(client).from('classifieds').select(FIELDS).eq('city',city)
    .in('status',['published','completed']).order('created_at',{ascending:false}).limit(100);
  check(error); return (data??[]) as Classified[];
}
export async function getMine(client:SupabaseClient|null,userId:string,city:string):Promise<Classified[]> {
  const {data,error}=await db(client).from('classifieds').select(FIELDS+',rejection_reason')
    .eq('author_id',userId).eq('city',city)
    .order('created_at',{ascending:false}).limit(100);
  check(error); return (data??[]) as Classified[];
}
export async function getPending(client:SupabaseClient|null,city:string):Promise<Classified[]> {
  const {data,error}=await db(client).from('classifieds').select(FIELDS+',rejection_reason').eq('city',city)
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
    city:d.city.trim(),title:d.title.trim(),description:d.description.trim(),
    category:d.category.trim(),district:d.district.trim(),deal_type:d.deal_type,price_rub:d.price_rub,
  });
  check(error);
}
export async function updateClassifiedDraft(
  client:SupabaseClient|null,id:string,userId:string,d:Draft,
):Promise<void> {
  const invalid=validateDraft(d);
  if(invalid)throw Error(invalid);
  const {data,error}=await db(client).from('classifieds').update({
    title:d.title.trim(),description:d.description.trim(),category:d.category.trim(),
    district:d.district.trim(),deal_type:d.deal_type,price_rub:d.price_rub,status:'draft',
  }).eq('id',id).eq('author_id',userId)
    .in('status',['draft','rejected']).select('id').maybeSingle();
  check(error);
  if(!data)throw Error('Черновик нельзя изменить после отправки на проверку.');
}
export async function submitForReview(client:SupabaseClient|null,id:string,userId:string):Promise<void> {
  const {data,error}=await db(client).from('classifieds').update({status:'pending'})
    .eq('id',id).eq('author_id',userId).in('status',['draft','rejected'])
    .select('id').maybeSingle();
  check(error);
  if(!data) throw Error('Не удалось отправить объявление на проверку.');
}
export async function moderate(client:SupabaseClient|null,id:string,approved:boolean,reason=''):Promise<void> {
  const text=reason.trim();
  if(!approved && (text.length<10 || text.length>500)) {
    throw Error('Укажите причину отклонения: от 10 до 500 символов.');
  }
  const {error}=await db(client).rpc('review_classified_with_reason',{
    p_listing_id:id,p_approve:approved,p_reason:approved?null:text,
  });
  check(error);
}
export async function markComplete(client:SupabaseClient|null,id:string):Promise<void> {
  const {error}=await db(client).rpc('complete_classified',{p_listing_id:id});
  check(error);
}
export async function archiveClassified(client:SupabaseClient|null,id:string):Promise<void> {
  const {error}=await db(client).rpc('archive_classified',{p_listing_id:id});
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
export const CLASSIFIED_MESSAGE_PAGE_SIZE=100;
export type MessageCursor=Pick<ChatMessage,'created_at'|'id'>;
const messageUuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messageTimestampPattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
export interface ClassifiedUnreadCount {
  conversation_id:string;unread_count:number;
}
export async function getClassifiedUnreadCounts(client:SupabaseClient|null):Promise<Record<string,number>> {
  const {data,error}=await db(client).rpc('get_classified_unread_counts');
  check(error);
  const output:Record<string,number>=Object.create(null) as Record<string,number>;
  for(const row of (data??[]) as ClassifiedUnreadCount[]) {
    const count=Number(row.unread_count);
    if(Number.isSafeInteger(count)&&count>0)output[row.conversation_id]=count;
  }
  return output;
}
export async function markClassifiedMessagesRead(
  client:SupabaseClient|null,threadId:string,messageId:string,
):Promise<void> {
  const {error}=await db(client).rpc('mark_classified_messages_read',{
    p_conversation_id:threadId,p_message_id:messageId,
  });
  check(error);
}
export async function getMessages(client:SupabaseClient|null,threadId:string):Promise<ChatMessage[]> {
  // Latest window first; reverse only after fetching for chronological display.
  const {data,error}=await db(client).from('classified_messages').select(MESSAGE_FIELDS)
    .eq('conversation_id',threadId)
    .order('created_at',{ascending:false}).order('id',{ascending:false})
    .limit(CLASSIFIED_MESSAGE_PAGE_SIZE);
  check(error);
  return ((data??[]) as ChatMessage[]).slice().reverse();
}
export async function getOlderMessages(
  client:SupabaseClient|null,threadId:string,before:MessageCursor,
):Promise<ChatMessage[]> {
  // Prevent a malformed cursor from injecting PostgREST OR filter syntax.
  if(!messageUuidPattern.test(before.id)||!messageTimestampPattern.test(before.created_at) ||
      !Number.isFinite(Date.parse(before.created_at)))
    throw Error('Некорректный указатель истории сообщений.');
  // Keyset pagination: no duplicates/skipped rows when timestamps are equal,
  // and newly arrived messages do not shift older pages.
  const cursorFilter='created_at.lt.'+before.created_at+
    ',and(created_at.eq.'+before.created_at+',id.lt.'+before.id+')';
  const {data,error}=await db(client).from('classified_messages').select(MESSAGE_FIELDS)
    .eq('conversation_id',threadId)
    .or(cursorFilter)
    .order('created_at',{ascending:false}).order('id',{ascending:false})
    .limit(CLASSIFIED_MESSAGE_PAGE_SIZE);
  check(error);
  return ((data??[]) as ChatMessage[]).slice().reverse();
}
export async function sendMessage(client:SupabaseClient|null,threadId:string,body:string):Promise<void> {
  if(body.trim().length<1 || body.trim().length>2000) throw Error('Сообщение должно быть от 1 до 2000 символов.');
  const {error}=await db(client).rpc('send_classified_message',{p_conversation_id:threadId,p_body:body.trim()});
  check(error);
}


export interface ClassifiedReport {
  id:string;listing_id:string;reason:string;state:'open'|'dismissed'|'action_taken';
  created_at:string;
  classifieds:{city:string;title:string};
}
export async function submitClassifiedReport(client:SupabaseClient|null,listingId:string,reason:string):Promise<void> {
  const message=reason.trim();
  if(message.length<10 || message.length>1000) throw Error('Причина жалобы: от 10 до 1000 символов.');
  const {error}=await db(client).from('classified_reports').insert({listing_id:listingId,reason:message});
  if(error?.code==='23505') throw Error('Вы уже отправляли жалобу на это объявление.');
  check(error);
}
export async function getOpenClassifiedReports(client:SupabaseClient|null,city:string):Promise<ClassifiedReport[]> {
  const {data,error}=await db(client).from('classified_reports')
    .select('id,listing_id,reason,state,created_at,classifieds!inner(city,title)')
    .eq('state','open').eq('classifieds.city',city)
    .order('created_at',{ascending:true}).limit(100);
  check(error);
  return (data??[]) as unknown as ClassifiedReport[];
}
export async function reviewClassifiedReport(client:SupabaseClient|null,id:string,hide:boolean):Promise<void> {
  const {error}=await db(client).rpc('review_classified_report',{p_report_id:id,p_hide_listing:hide});
  check(error);
}
export async function getBlockedClassifiedUsers(client:SupabaseClient|null,userId:string):Promise<string[]> {
  const {data,error}=await db(client).from('classified_user_blocks').select('blocked_id').eq('blocker_id',userId);
  check(error);
  return (data??[]).map(row=>String(row.blocked_id));
}
export async function setClassifiedUserBlock(client:SupabaseClient|null,blockerId:string,targetId:string,blocked:boolean):Promise<void> {
  if(blockerId===targetId) throw Error('Нельзя заблокировать самого себя.');
  if(blocked) {
    const {error}=await db(client).from('classified_user_blocks')
      .insert({blocker_id:blockerId,blocked_id:targetId});
    if(error?.code!=='23505')check(error);
  } else {
    const {error}=await db(client).from('classified_user_blocks')
      .delete().eq('blocker_id',blockerId).eq('blocked_id',targetId);
    check(error);
  }
}
