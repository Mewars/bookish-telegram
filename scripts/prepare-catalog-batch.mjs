// Prepares an atomic, reviewed DATA import. Never connects to a database.
const quote=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const columns=['id','city','kind','title','category','description','address','phone','hours','website','vk_url','latitude','longitude','source_type','source_url','verified_at','status','image_url'];
export function prepareCatalogBatch(manifest,revision){
 if(manifest.batch!=='2026-10-25-owner-catalog'||!Array.isArray(manifest.records)||!Array.isArray(manifest.enrich)||!/^[a-f0-9]{32}$/.test(revision))throw Error('Invalid reviewed batch or revision');
 const ids=new Set(),identities=new Set();
 for(const row of manifest.records){
  const identity=[row.city,row.title,row.address].map(v=>String(v||'').trim().toLocaleLowerCase('ru').replaceAll('ё','е').replace(/\s+/g,' ')).join('\0');
  if(ids.has(row.id)||identities.has(identity)||!row.id?.startsWith('place-yandex-')||!row.city||!row.title||!row.address||row.website||row.vk_url||row.status!=='published'||row.source_type!=='user_provided'||!row.source_url?.startsWith('https://yandex.ru/maps/org/'))throw Error('Unsafe or duplicate organization');
  ids.add(row.id);identities.add(identity);
 }
 for(const patch of manifest.enrich)if(Object.keys(patch.values).some(k=>!['phone','hours'].includes(k)))throw Error('Only missing public contact fields may be enriched');
 return `BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.organizations IN SHARE ROW EXCLUSIVE MODE;
DO $batch_guard$ BEGIN
 IF (SELECT md5(coalesce(string_agg(id || ':' || updated_at::text,',' ORDER BY id),'')) FROM public.organizations) <> '${revision}' THEN
  RAISE EXCEPTION 'Catalog changed after review; review the fresh catalog before importing';
 END IF;
END $batch_guard$;
INSERT INTO public.organizations (${columns.join(',')})
 SELECT ${columns.join(',')} FROM jsonb_populate_recordset(null::public.organizations,${quote(manifest.records)});
UPDATE public.organizations o SET
 phone=coalesce(nullif(o.phone,''),m.values->>'phone'),
 hours=coalesce(nullif(o.hours,''),m.values->>'hours')
FROM jsonb_to_recordset(${quote(manifest.enrich)}) AS m(id text,city text,values jsonb)
WHERE o.id=m.id AND o.city=m.city AND o.status='published';
COMMIT;
SELECT count(*) AS total,count(*) FILTER(WHERE status='published') AS published FROM public.organizations;`;
}
