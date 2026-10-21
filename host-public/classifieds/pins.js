const unavailable=error=>['42P01','PGRST205'].includes(error?.code);
export async function readCityPins(client,city){
 const rows=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await client.from('classified_owner_pins')
   .select('listing_id,pinned_at,classifieds!inner(city,status)')
   .eq('classifieds.city',city).eq('classifieds.status','published')
   .order('pinned_at',{ascending:false}).range(offset,offset+499);
  if(error){if(unavailable(error))return {available:false,pins:new Map()};throw error;}
  rows.push(...(data||[]));if(!data||data.length<500)break;
 }
 return {available:true,pins:new Map(rows.map(row=>[row.listing_id,row.pinned_at]))};
}
export function sortPinnedClassifieds(rows,pins){
 return [...rows].sort((a,b)=>Number(pins.has(b.id))-Number(pins.has(a.id))||
  (pins.has(a.id)?String(pins.get(b.id)).localeCompare(String(pins.get(a.id))):String(b.created_at).localeCompare(String(a.created_at))));
}
