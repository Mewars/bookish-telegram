export const MESSAGE_PAGE_SIZE=100;

export async function readChatMessages(client,threadId,before=null){
 let query=client.from('classified_messages')
  .select('id,conversation_id,sender_id,body,created_at').eq('conversation_id',threadId);
 if(before){
  // Validate values before including them in PostgREST filter syntax.
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(before.id)||
   !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(before.created_at)||
   !Number.isFinite(Date.parse(before.created_at)))throw Error('Некорректный указатель истории сообщений.');
  query=query.or('created_at.lt.'+before.created_at+
   ',and(created_at.eq.'+before.created_at+',id.lt.'+before.id+')');
 }
 const {data,error}=await query.order('created_at',{ascending:false})
  .order('id',{ascending:false}).limit(MESSAGE_PAGE_SIZE);
 if(error)throw error;
 return (data||[]).slice().reverse();
}
