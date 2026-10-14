import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertPhotoBatch,nextPhotoSlot,photoKey,CLASSIFIED_PHOTO_LIMIT } from '../src/classifieds/photos.ts';

test('classified album validates reservation keys and ten available slots',()=>{
  assert.equal(CLASSIFIED_PHOTO_LIMIT,10);
  assert.equal(nextPhotoSlot([{slot:0},{slot:2}]),1);
  assert.equal(nextPhotoSlot(Array.from({length:10},(_,slot)=>({slot}))),null);
  const id='11111111-1111-4111-8111-111111111111';
  assert.equal(photoKey(id,'22222222-2222-4222-8222-222222222222','webp'),
    id+'/22222222-2222-4222-8222-222222222222.webp');
  assert.throws(()=>photoKey('../bad',id,'webp'),/Неверный/);
  const photo={name:'real.jpg',type:'image/jpeg',size:450_000};
  assert.doesNotThrow(()=>assertPhotoBatch([photo],9));
  assert.throws(()=>assertPhotoBatch([photo,photo],9),/10 фотографий/);
  assert.throws(()=>assertPhotoBatch([{...photo,type:'image/svg+xml'}],0),/JPG/);
});
test('classified storage remains private and release route remains gated',async()=>{
  const [sql,ui,repo,app]=await Promise.all([
    readFile('docs/sql/classified-photos-private-v1.sql','utf8'),
    readFile('src/classifieds/ClassifiedPhotoGallery.tsx','utf8'),
    readFile('src/classifieds/photos.ts','utf8'),readFile('src/App.tsx','utf8'),
  ]);
  assert.match(sql,/VALUES \('ryadom-classified-photos','ryadom-classified-photos',false,2097152/);
  assert.match(sql,/ALTER TABLE public.classified_photos FORCE ROW LEVEL SECURITY/);
  assert.match(sql,/slot BETWEEN 0 AND 9/);
  assert.match(sql,/l.status IN \('published','completed'\)/);
  assert.match(sql,/l.status IN \('draft','rejected'\)/);
  assert.match(repo,/prepareAdminImage\(file,'gallery'\)/);
  assert.match(repo,/\.createSignedUrl\(/);
  assert.doesNotMatch(repo,/getPublicUrl/);
  assert.match(ui,/право публиковать эти фотографии/);
  assert.match(app,/VITE_CLASSIFIEDS_ENABLED === 'true'/);
});
