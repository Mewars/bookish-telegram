import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {archiveClassified} from '../src/classifieds/repository.ts';

test('archive uses an owner-checked RPC, never an unrestricted status update',async()=>{
  const calls=[];
  const client={async rpc(name,args){calls.push([name,args]);return {error:null};}};
  await archiveClassified(client,'owned-listing');
  assert.deepEqual(calls,[['archive_classified',{p_listing_id:'owned-listing'}]]);
});

test('archive failures remain errors, not false success',async()=>{
  const client={async rpc(){return {error:{message:'Listing unavailable for archiving'}};}};
  await assert.rejects(archiveClassified(client,'somebody-elses-listing'),/Операция не выполнена/);
});

test('closed-beta owner archive is guarded by confirmation and a secured RPC',async()=>{
  const [page,sql,app]=await Promise.all([
    readFile('src/classifieds/ClassifiedsPage.tsx','utf8'),
    readFile('docs/sql/classified-owner-archive-v1.sql','utf8'),
    readFile('src/App.tsx','utf8'),
  ]);
  assert.match(page, /tab==='mine'&&<div className="classifieds-card-actions">/);
  assert.match(page, /\['published','completed'\]\.includes\(entry\.status\)/);
  assert.match(page, /window\.confirm\('Снять объявление с публикации/);
  assert.match(page, /execute\(\(\)=>archiveClassified\(supabase,entry\.id\)/);
  assert.match(sql, /author_id = auth\.uid\(\)/);
  assert.match(sql, /status IN \('published', 'completed'\)/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = ''/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.archive_classified\(uuid\) FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.archive_classified\(uuid\) TO authenticated/);
  assert.match(app, /VITE_CLASSIFIEDS_ENABLED === 'true'/);
  assert.match(app, /isRyadomTestBackend/);
});
