import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';

const columns=['id','city','kind','title','category','description','address','phone','hours','website','vk_url','latitude','longitude','source_type','source_url','verified_at','status','image_url'];
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;

// Offline SQL preparation only. No credentials, DB connections or automatic execution.
export function prepareImport(manifest,before){
 if(!['2026-10-21-owner-organizations','2026-10-21-owner-lodging'].includes(manifest.batch)||!Array.isArray(before))throw Error('Unexpected import or snapshot');
 const records=manifest.records, ids=new Set(records.map(r=>r.organization.id));
 if(ids.size!==records.length)throw Error('Duplicate import ID');
 const existing=new Map(before.map(r=>[r.id,r]));
 for(const r of records){
  if(r.action==='insert'&&existing.has(r.organization.id))throw Error('Insert ID already exists');
  if(r.action==='enrich'&&!existing.has(r.organization.id))throw Error('Enrichment target missing');
  if(!['insert','enrich'].includes(r.action))throw Error('Unknown action');
 }
 const inserts=records.filter(r=>r.action==='insert').map(r=>r.organization);
 const enrich=records.filter(r=>r.action==='enrich').map(r=>r.organization);
 // Compare jsonb values from the same database snapshot, including owner edits.
 const snapshot=[...before].sort((a,b)=>a.id.localeCompare(b.id,'en'));
 return `BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.organizations IN SHARE ROW EXCLUSIVE MODE;
DO $guard$
BEGIN
 IF (SELECT coalesce(jsonb_object_agg(id,to_jsonb(o)),'{}'::jsonb) FROM public.organizations o)
    IS DISTINCT FROM (SELECT coalesce(jsonb_object_agg(e.id,to_jsonb(e)),'{}'::jsonb)
      FROM jsonb_populate_recordset(null::public.organizations,${literal(snapshot)}) e) THEN
  RAISE EXCEPTION 'Catalog changed after review; take a fresh snapshot and review differences';
 END IF;
END $guard$;
INSERT INTO public.organizations (${columns.join(',')})
SELECT ${columns.join(',')} FROM jsonb_populate_recordset(null::public.organizations,${literal(inserts)});
UPDATE public.organizations o SET
 category=CASE WHEN o.category IN ('Кафе','Гостиницы') THEN m.category ELSE o.category END,
 phone=coalesce(nullif(o.phone,''),m.phone),hours=coalesce(nullif(o.hours,''),m.hours),
 website=coalesce(nullif(o.website,''),m.website),
 latitude=coalesce(o.latitude,m.latitude),longitude=coalesce(o.longitude,m.longitude),
 source_url=coalesce(nullif(o.source_url,''),m.source_url)
FROM jsonb_populate_recordset(null::public.organizations,${literal(enrich)}) m
WHERE o.id=m.id AND o.city=m.city AND o.status='published';
COMMIT;
SELECT count(*) as total, count(*) FILTER (WHERE status='published') as published,
 count(*) FILTER (WHERE status='draft') as draft FROM public.organizations;
`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [manifestPath,snapshotPath,outputPath]=process.argv.slice(2);
 if(!manifestPath||!snapshotPath||!outputPath)throw Error('Usage: node scripts/prepare-reviewed-organization-import.mjs MANIFEST PRIVATE_SNAPSHOT OUTPUT_SQL');
 await writeFile(outputPath,prepareImport(JSON.parse(await readFile(manifestPath,'utf8')),JSON.parse(await readFile(snapshotPath,'utf8'))));
 console.log('Prepared SQL with a concurrent-edit guard. Review and apply separately.');
}
