import type { SupabaseClient } from '@supabase/supabase-js';

export type CommunityPostType = 'post'|'question'|'news';
export type CommunityPostStatus = 'draft'|'pending'|'published'|'rejected'|'archived';
export interface CommunityPost {
  id:string;city:string;author_id:string;post_type:CommunityPostType;
  title:string;body:string;status:CommunityPostStatus;created_at:string;updated_at:string;review_reason?:string;
}
export interface CommunityComment {
  id:string;post_id:string;author_id:string;body:string;
  status:'pending'|'published'|'rejected'|'archived';created_at:string;
}
// The embedded parent is a published post visible under existing RLS.
export interface ModerationCommunityComment extends CommunityComment {
  community_posts: Pick<CommunityPost,'city'|'title'|'body'|'post_type'|'status'>;
}
export function mayModerateCommunityMaterial(actorId:string|null,authorId:string):boolean {
  return actorId!==null && actorId!==authorId;
}
export const postTypeNames:Record<CommunityPostType,string>={
  post:'Пост жителя',question:'Вопрос',news:'Новости редакции',
};
const postFields='id,city,author_id,post_type,title,body,status,created_at,updated_at';
const commentFields='id,post_id,author_id,body,status,created_at';
function clientOrThrow(client:SupabaseClient|null):SupabaseClient{
  if(!client)throw Error('Тестовая база городской ленты не подключена.');
  return client;
}
function ensure(error:{message:string}|null):void{
  if(error)throw Error('Не удалось выполнить действие. Проверьте подключение или права аккаунта.');
}
export function validatePost(title:string,body:string):string|null {
  if(title.trim().length<5||title.trim().length>160)return 'Название: от 5 до 160 символов.';
  if(body.trim().length<10||body.trim().length>5000)return 'Текст: от 10 до 5000 символов.';
  return null;
}
export function validateComment(body:string):string|null {
  if(body.trim().length<2||body.trim().length>2000)return 'Комментарий: от 2 до 2000 символов.';
  return null;
}
export async function publishedPosts(client:SupabaseClient|null,city:string):Promise<CommunityPost[]>{
  const {data,error}=await clientOrThrow(client).from('community_posts').select(postFields)
    .eq('city',city).eq('status','published').order('created_at',{ascending:false}).limit(100);
  ensure(error);return (data??[]) as CommunityPost[];
}
export async function myCommunityPosts(client:SupabaseClient|null,userId:string,city:string):Promise<CommunityPost[]>{
  const {data,error}=await clientOrThrow(client).from('community_posts').select(postFields)
    .eq('city',city).eq('author_id',userId).order('created_at',{ascending:false}).limit(100);
  ensure(error);
  const rows=(data??[]) as CommunityPost[];
  const ids=rows.filter(post=>post.status==='rejected').map(post=>post.id);
  if(ids.length){
    const reasons=await clientOrThrow(client).from('community_post_review_reasons')
      .select('post_id,reason,reviewed_at').in('post_id',ids);
    ensure(reasons.error);
    const byId=new Map((reasons.data??[]).map((item:{post_id:string;reason:string})=>[item.post_id,item.reason]));
    for(const post of rows)post.review_reason=byId.get(post.id);
  }
  return rows;
}
export async function pendingCommunityPosts(client:SupabaseClient|null,city:string):Promise<CommunityPost[]>{
  const {data,error}=await clientOrThrow(client).from('community_posts').select(postFields)
    .eq('city',city).eq('status','pending').order('created_at',{ascending:true}).limit(100);
  ensure(error);return (data??[]) as CommunityPost[];
}
export async function canEditCityNews(client:SupabaseClient|null,city:string):Promise<boolean>{
  const {data,error}=await clientOrThrow(client).from('city_admin_access').select('city,role,active').eq('active',true);
  ensure(error);
  return (data??[]).some((row:{city:string;role:string})=>row.city===city||(row.city==='*'&&row.role==='owner'));
}
export async function createCommunityPost(client:SupabaseClient|null,city:string,type:'post'|'question',title:string,body:string):Promise<void>{
  const invalid=validatePost(title,body);
  if(invalid)throw Error(invalid);
  const {error}=await clientOrThrow(client).rpc('create_community_post',{
    p_city:city,p_type:type,p_title:title.trim(),p_body:body.trim(),
  });
  ensure(error);
}
export async function updateCommunityDraft(client:SupabaseClient|null,id:string,authorId:string,title:string,body:string):Promise<void>{
  const invalid=validatePost(title,body);
  if(invalid)throw Error(invalid);
  const {data,error}=await clientOrThrow(client).from('community_posts')
    .update({title:title.trim(),body:body.trim(),status:'draft'})
    .eq('id',id).eq('author_id',authorId)
    .in('status',['draft','rejected']).select('id').maybeSingle();
  ensure(error);
  if(!data)throw Error('Черновик нельзя изменить после отправки на проверку.');
}
// Withdrawal is server-authorized; the caller cannot supply a different author.
export async function archiveCommunityPost(client:SupabaseClient|null,id:string):Promise<void>{
  const {error}=await clientOrThrow(client).rpc('archive_community_post',{p_id:id});
  ensure(error);
}
export async function submitCommunityPost(client:SupabaseClient|null,id:string,authorId:string):Promise<void>{
  const {data,error}=await clientOrThrow(client).from('community_posts').update({status:'pending'})
    .eq('id',id).eq('author_id',authorId).in('status',['draft','rejected']).select('id').maybeSingle();
  ensure(error);
  if(!data)throw Error('Публикацию не удалось отправить на модерацию.');
}
export async function reviewCommunityPost(client:SupabaseClient|null,id:string,approve:boolean,reason?:string):Promise<void>{
  const cleaned=reason?.trim()??'';
  if(!approve&&(cleaned.length<3||cleaned.length>1000))throw Error('Укажите причину отказа: от 3 до 1000 символов.');
  const {error}=await clientOrThrow(client).rpc('review_community_post_with_reason',{p_id:id,p_approve:approve,p_reason:approve?null:cleaned});
  ensure(error);
}
export async function publishCityNews(client:SupabaseClient|null,city:string,title:string,body:string):Promise<void>{
  const invalid=validatePost(title,body);
  if(invalid)throw Error(invalid);
  const {error}=await clientOrThrow(client).rpc('publish_city_news',{
    p_city:city,p_title:title.trim(),p_body:body.trim(),
  });
  ensure(error);
}
export async function publicCommunityComments(client:SupabaseClient|null,postId:string):Promise<CommunityComment[]>{
  const {data,error}=await clientOrThrow(client).from('community_comments').select(commentFields)
    .eq('post_id',postId).eq('status','published').order('created_at',{ascending:true}).limit(100);
  ensure(error);return (data??[]) as CommunityComment[];
}
export async function sendCommunityComment(client:SupabaseClient|null,postId:string,body:string):Promise<void>{
  const invalid=validateComment(body);
  if(invalid)throw Error(invalid);
  const {error}=await clientOrThrow(client).rpc('submit_community_comment',{p_post_id:postId,p_body:body.trim()});
  ensure(error);
}
export async function pendingCommunityComments(client:SupabaseClient|null,city:string):Promise<ModerationCommunityComment[]>{
  // Read context only for a published parent in the selected city, still subject to RLS.
  const {data,error}=await clientOrThrow(client).from('community_comments')
    .select('id,post_id,author_id,body,status,created_at,community_posts!inner(city,title,body,post_type,status)')
    .eq('status','pending').eq('community_posts.city',city)
    .eq('community_posts.status','published')
    .order('created_at',{ascending:true}).limit(100);
  ensure(error);return (data??[]) as unknown as ModerationCommunityComment[];
}
export async function reviewCommunityComment(client:SupabaseClient|null,id:string,approve:boolean):Promise<void>{
  const {error}=await clientOrThrow(client).rpc('review_community_comment',{p_id:id,p_approve:approve});
  ensure(error);
}
