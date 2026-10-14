import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { photoGeometry, validPhotoFile, adminImageExtension } from '../src/photos/adminImage.ts';

test('portrait covers crop vertically without upscaling', () => {
  const g = photoGeometry(900,1600,'cover');
  assert.equal(g.sx,0);
  assert.ok(g.sy > 0);
  assert.equal(g.width,900);
  assert.equal(g.height,506);
  assert.ok(Math.abs(g.width/g.height-16/9)<0.01);
});
test('wide landscape covers crop symmetrically and stay under 1440x810', () => {
  const g = photoGeometry(4032,2268,'cover');
  assert.equal(g.width,1440);
  assert.equal(g.height,810);
  assert.ok(g.sw <=4032 && g.sh<=2268);
  assert.equal(g.sx,0);
});
test('panorama covers center-crop horizontally', () => {
  const g = photoGeometry(3000,900,'cover');
  assert.ok(g.sx>0);
  assert.equal(g.sy,0);
  assert.ok(Math.abs(g.width/g.height-16/9)<0.01);
});
test('gallery mode fits photo fully without cropping', () => {
  const g = photoGeometry(3000,900,'gallery');
  assert.equal(g.sx,0);assert.equal(g.sy,0);
  assert.equal(g.sw,3000);assert.equal(g.sh,900);
  assert.equal(g.width,1600);
  assert.ok(g.height<=1200);
});
test('validPhotoFile only permits normal photo formats up to 24 MB', () => {
  assert.equal(validPhotoFile({type:'image/jpeg',name:'photo.jpg',size:4_000_000}),true);
  assert.equal(validPhotoFile({type:'',name:'photo.heic',size:1_000_000}),true);
  assert.equal(validPhotoFile({type:'image/svg+xml',name:'evil.svg',size:100}),false);
  assert.equal(validPhotoFile({type:'image/jpeg',name:'photo.jpg',size:40_000_000}),false);
  assert.equal(adminImageExtension({type:'image/webp'}),'webp');
  assert.equal(adminImageExtension({type:'image/jpeg'}),'jpg');
});
test('admin image upload emits matching MIME and key, without raw metadata', async () => {
  const image = await readFile('src/photos/adminImage.ts','utf8');
  const repo = await readFile('src/admin/repository.ts','utf8');
  const panel = await readFile('src/admin/AdminPage.tsx','utf8');
  assert.match(image,/canvas\.toBlob/);
  assert.match(image,/image\/webp/);
  assert.match(image,/image\/jpeg/);
  assert.match(image,/geometry\.sx,geometry\.sy,geometry\.sw,geometry\.sh/);
  assert.match(repo,/prepareAdminImage\(file, 'cover'\)/);
  assert.match(repo,/contentType: optimized\.type/);
  assert.match(repo,/upsert: false/);
  assert.match(panel,/removeOrphanedAdminPhoto/);
  assert.match(panel,/16:9/);
});
