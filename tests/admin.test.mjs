import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canManageCity, newAdminDraft, rowToAdminDraft, validateAdminDraft } from '../src/admin/model.ts';
import { mergePublished } from '../src/organizations/model.ts';
import { readFile } from 'node:fs/promises';

const owner = { user_id: 'u1', city: '*', role: 'owner', active: true };
const editor = { user_id: 'u2', city: 'Енисейск', role: 'editor', active: true };
const city = 'Енисейск';
const draft = { ...newAdminDraft(city), title: 'Новая пиццерия', category: 'Кафе', description: 'Подтверждённый пример для теста.' };

test('owner can manage cities but city editor cannot cross city boundaries', () => {
  assert.equal(canManageCity([owner], city), true);
  assert.equal(canManageCity([owner], 'Ачинск'), true);
  assert.equal(canManageCity([editor], city), true);
  assert.equal(canManageCity([editor], 'Ачинск'), false);
  assert.equal(canManageCity([{ ...editor, active: false }], city), false);
  assert.equal(canManageCity([{ ...editor, city: '*' }], city), false);
  assert.equal(canManageCity([], city), false);
});

test('a listing needs real information; publishing requires separate verification', () => {
  assert.deepEqual(validateAdminDraft(draft, false), {});
  assert.ok(validateAdminDraft({ ...draft, status: 'published' }, false).confirmed);
  assert.deepEqual(validateAdminDraft({ ...draft, status: 'published' }, true), {});
  assert.ok(validateAdminDraft({ ...draft, title: '' }, true).title);
  assert.ok(validateAdminDraft({ ...draft, phone: 'call me' }, true).phone);
  assert.ok(validateAdminDraft({ ...draft, source_url: 'javascript:alert(1)' }, true).source_url);
  assert.ok(validateAdminDraft({ ...draft, image_url: 'data:text/html,...' }, true).image_url);
  assert.ok(validateAdminDraft({ ...draft, vk_url: 'https://example.com/vk' }, true).vk_url);
});

test('organization edits preserve id and old image is replaceable with a verified photo', () => {
  const row = {
    ...draft, image_url: 'https://cdn.example.org/authorized.webp',
    address: null, phone: null, hours: null, website: null, vk_url: null,
    source_url: null, latitude: null, longitude: null, source_type: 'manual_verified',
    verified_at: '2026-10-14', status: 'published',
    created_at: '', updated_at: '',
  };
  const local = [{ id: row.id || 'place-id', city, title: draft.title, category: draft.category, description: 'Старое', image: '/old.svg', kind: 'places' }];
  const remote = [{ ...row, id: 'place-id' }];
  assert.equal(rowToAdminDraft(remote[0]).image_url, row.image_url);
  const merged = mergePublished(local, remote, '/fallback.svg', true);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'place-id');
  assert.equal(merged[0].image, row.image_url);
});

test('authoritative database listing does not resurrect archived static places', () => {
  const staticPlaces = [
    { id: 'a', city, kind: 'places', title: 'A', category: 'Кафе', description: 'A', image: '/a.svg' },
    { id: 'b', city, kind: 'places', title: 'B', category: 'Кафе', description: 'B', image: '/b.svg' },
  ];
  assert.deepEqual(mergePublished(staticPlaces, [], '/fallback.svg', true), []);
  assert.equal(mergePublished(staticPlaces, [], '/fallback.svg').length, 2);
  const remote = [{
    id: 'a',city,title:'A',category:'Кафе',description:'Из базы',address:null,phone:null,hours:null,website:null,vk_url:null,image_url:null,
    latitude:null,longitude:null,source_type:'user_provided',source_url:null,verified_at:'2026-10-14',status:'published',created_at:'',updated_at:'',
  }];
  const merged = mergePublished(staticPlaces, remote, '/fallback.svg', true);
  assert.deepEqual(merged.map(item => item.id), ['a']);
  assert.equal(merged[0].image, '/a.svg');
});

test('admin UI is feature gated, requires a member row and does not contain privileged keys', async () => {
  const code = await readFile('src/admin/AdminPage.tsx', 'utf8');
  const app = await readFile('src/App.tsx','utf8');
  const repo = await readFile('src/admin/repository.ts','utf8');
  assert.match(code, /if \(!enabled\)/);
  assert.match(code, /readCityAccess/);
  assert.match(code, /validateAdminDraft\(draft, confirmed\)/);
  assert.match(app, /VITE_ADMIN_PANEL_ENABLED/);
  assert.match(repo, /requireCurrentUser/);
  assert.doesNotMatch(repo, /service_role|sb_secret_|localStorage/);
});
