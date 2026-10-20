// Only author-editable fields are sent; city and identity stay immutable.
export async function saveOwnedDraft(client,id,userId,draft) {
  const mutable={deal_type:draft.deal_type,category:draft.category,district:draft.district,
    title:draft.title,description:draft.description,price_rub:draft.price_rub,status:'draft'};
  const {data,error}=await client.from('classifieds').update(mutable).eq('id',id)
    .eq('author_id',userId).in('status',['draft','rejected']).select('id').maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Объявление уже отправлено на проверку или недоступно для редактирования. Обновите список.');
}
export async function submitOwnedDraft(client,id,userId) {
  const {data,error}=await client.from('classifieds').update({status:'pending'}).eq('id',id)
    .eq('author_id',userId).in('status',['draft','rejected']).select('id').maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Отправка на проверку не подтверждена. Обновите список объявлений.');
}
