export function validateRejectionReason(value) {
  const reason=String(value??'').trim();
  if(reason.length<3||reason.length>1000)throw Error('Укажите причину отказа: от 3 до 1000 символов.');
  return reason;
}
export async function rejectWallPost(client,id,value) {
  const reason=validateRejectionReason(value);
  const {error}=await client.rpc('review_community_post_with_reason',{p_id:id,p_approve:false,p_reason:reason});
  if(error)throw error;
}
export async function loadReviewReasons(client,posts) {
  const ids=posts.filter(post=>post.status==='rejected').map(post=>post.id);
  if(!ids.length)return new Map();
  const {data,error}=await client.from('community_post_review_reasons')
    .select('post_id,reason,reviewed_at').in('post_id',ids);
  if(error)throw error;
  return new Map((data||[]).map(item=>[item.post_id,item.reason]));
}
export async function saveWallDraft(client,id,authorId,title,body) {
  const cleanTitle=title.trim(),cleanBody=body.trim();
  if(cleanTitle.length<5||cleanTitle.length>160||cleanBody.length<10||cleanBody.length>5000)
    throw Error('Проверьте заголовок (5–160 символов) и текст (10–5000 символов).');
  const {data,error}=await client.from('community_posts')
    .update({title:cleanTitle,body:cleanBody,status:'draft'})
    .eq('id',id).eq('author_id',authorId).in('status',['draft','rejected'])
    .select('id').maybeSingle();
  if(error)throw error;
  if(!data)throw Error('Запись уже отправлена на проверку или недоступна для редактирования.');
}
