import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PREVIEW_STORAGE_KEY, readPreviewEdits, previewRows } from '../src/admin/previewStorage.ts';

const item = { id:'demo-card1',city:'Енисейск',kind:'places',title:'Тестовая организация',category:'Кафе',description:'Пробное описание',image:'data:image/webp;base64,AAA=',real:true };
const example = { item, status:'draft' };

test('preview edits are stored separately and never read Supabase', async () => {
  assert.equal(PREVIEW_STORAGE_KEY, 'ryadom.admin.rehearsal.v1');
  assert.deepEqual(readPreviewEdits(null), []);
  assert.deepEqual(readPreviewEdits('{bad json'), []);
  assert.deepEqual(readPreviewEdits(JSON.stringify([example])), [example]);
  const code = await readFile('src/admin/AdminPreviewPage.tsx', 'utf8');
  const route = await readFile('src/App.tsx', 'utf8');
  assert.doesNotMatch(code, /@supabase\/supabase-js|supabase\.from\(|supabase\.storage|saveAdminOrganization|uploadAdminPhoto/);
  assert.match(code,/localStorage\.setItem\(PREVIEW_STORAGE_KEY/);
  assert.match(code,/localStorage\.removeItem\(PREVIEW_STORAGE_KEY/);
  assert.match(code,/Никакие данные в Supabase|В Supabase и реальном каталоге ничего не меняется/);
  assert.match(route,/const adminPreviewEnabled = true/);
  assert.match(route,/section === 'admin-preview'/);
  assert.match(route,/VITE_ADMIN_PANEL_ENABLED/);
});
test('invalid saved payloads cannot inject script URLs or override other cities', () => {
  const evil = { item: { ...item, image:'javascript:alert(1)' }, status:'published' };
  assert.deepEqual(readPreviewEdits(JSON.stringify([evil]))[0].item.image, '');
  assert.deepEqual(readPreviewEdits(JSON.stringify([{...example,item:{...item,city:'Other'}}])), []);
  assert.deepEqual(readPreviewEdits(JSON.stringify([{...example,item:{...item,kind:'events'}}])), []);
  assert.deepEqual(readPreviewEdits(JSON.stringify([{...example,status:'superadmin'}])), []);
  assert.deepEqual(readPreviewEdits(JSON.stringify([{...example,item:{...item,id:'../bad'}}])), []);
});
test('rehearsal overlays real catalog baseline in memory but never mutates baseline', () => {
  const baseline = [{ item:{...item,image:'/existing.webp',title:'Старое'},status:'published'}];
  const edits = [{item:{...item,image:'',title:'Новое'},status:'draft'}];
  const merged = previewRows(baseline, edits);
  assert.equal(merged.length,1);
  assert.equal(merged[0].item.title,'Новое');
  assert.equal(merged[0].item.image,'/existing.webp');
  assert.equal(baseline[0].item.title,'Старое');
});
test('photo chooser resizes in browser before local-only preview, no SVG or large file', async () => {
  const code = await readFile('src/admin/AdminPreviewPage.tsx','utf8');
  assert.match(code, /createImageBitmap\(file\)/);
  assert.match(code, /canvas\.toDataURL\('image\/webp'/);
  assert.match(code, /'image\/jpeg', 'image\/png', 'image\/webp'/);
  assert.match(code, /file\.size > 5_000_000/);
  assert.match(code, /Обработка фото/);
  assert.match(code, /stored only|Сохранено в пробном кабинете/);
});
