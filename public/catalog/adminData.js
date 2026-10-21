// The database still enforces RLS; narrowing the query also avoids loading
// public organizations from other cities into a city editor's private screen.
export async function readManagedOrganizations(client,roles){
 const active=roles.filter(role=>role.active&&['owner','editor'].includes(role.role));
 const owner=active.some(role=>role.role==='owner'&&role.city==='*');
 const cities=[...new Set(active.filter(role=>role.city!=='*').map(role=>role.city))];
 if(!owner&&!cities.length)return [];
 const items=[];
 for(let offset=0;offset<10000;offset+=500){
  let query=client.from('organizations').select('id,title,category,description,address,city,kind,status').order('id').range(offset,offset+499);
  if(!owner)query=query.in('city',cities);
  const result=await query;
  if(result.error)throw result.error;
  if(!Array.isArray(result.data))throw Error('Каталог недоступен');
  // RLS is authoritative, and this final check protects the city view too.
  items.push(...result.data.filter(item=>owner||cities.includes(item.city)));
  if(result.data.length<500)return items;
 }
 throw Error('Каталог слишком большой для полной загрузки. Счётчики не обновлены.');
}
