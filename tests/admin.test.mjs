import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canManageCity, nextAvailabilityStatus, manageableAdminCities, newAdminDraft, rowToAdminDraft, validateAdminDraft } from '../src/admin/model.ts';
import { directoryCategories, categoryForOrganization } from '../src/admin/directoryCategories.ts';
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

test('new empty city can immediately receive its first owner-created listing', () => {
  const directory = ['Енисейск', 'Лесосибирск', 'Ачинск'];
  assert.deepEqual(manageableAdminCities([owner], ['Енисейск'], directory),
    ['Ачинск', 'Енисейск', 'Лесосибирск']);
  assert.equal(manageableAdminCities([owner], [], ['Новый город'])[0], 'Новый город');
});

test('franchisee never sees public but unassigned cities in admin selector', () => {
  const directory = ['Енисейск', 'Лесосибирск', 'Ачинск'];
  assert.deepEqual(manageableAdminCities([editor], ['Енисейск', 'Ачинск'], directory), ['Енисейск']);
  assert.deepEqual(manageableAdminCities([{ ...editor, active: false }], ['Енисейск'], directory), []);
  assert.deepEqual(manageableAdminCities([], ['Енисейск'], directory), []);
  assert.deepEqual(manageableAdminCities([{ ...editor, city: '*' }], ['Енисейск'], directory), []);
  assert.deepEqual(manageableAdminCities([{ ...editor, city: 'Ачинск' }], [], directory), ['Ачинск']);
});

test('owner city management notifies admin filter after successful save', async () => {
  const component = await readFile('src/admin/CityManagement.tsx','utf8');
  const page = await readFile('src/admin/AdminPage.tsx','utf8');
  assert.match(component, /onCitySaved\?\.\(trimmed\)/);
  assert.match(page, /owner \? directoryCities\.map\(city => city\.name\) : \[\]/);
  assert.match(page, /onCitySaved=\{cityName => \{ setCityFilter\(cityName\)/);
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

test('unified dashboard preserves categories for existing listings and supports new city categories', () => {
  assert.equal(directoryCategories.length, 24);
  const identifiers = new Set(directoryCategories.map(category => category.id));
  assert.equal(identifiers.size, directoryCategories.length);
  const examples = [
    ['Кафе','food'], ['Гостиницы','hotel'], ['Музеи / История','museum'],
    ['Парки / Прогулки','park'], ['Госуслуги','services'], ['Почта','mail'],
    ['Салоны красоты','beauty'], ['Достопримечательности','landmark'],
    ['Библиотеки','library'], ['Культура','culture'], ['Другое','general'],
    ['Общественные организации / Общественные объединения','associations'],
    ['ЖКХ / Управляющие компании','housing'], ['Транспорт / Аэропорты','transport'],
    ['Инфраструктура / Электроснабжение','infrastructure'],
    ['Образование и молодёжь / Детские сады','education'],
  ];
  for (const [category,expected] of examples)
    assert.equal(categoryForOrganization({ category }),expected,category);
  assert.ok(directoryCategories.every(category => category.color.startsWith('#')));
  assert.ok(directoryCategories.every(category => category.value.length > 0));
});

test('owner dashboard has actionable city overview with separate published counts', async () => {
  const source = await readFile('src/admin/AdminPage.tsx', 'utf8');
  assert.match(source, /screen === 'overview' && owner && <section className="admin-panel admin-cms-network"/);
  assert.match(source, /cities\.map\(cityName =>/);
  assert.match(source, /cityOrganizations\.length/);
  assert.match(source, /setCityFilter\(cityName\); navigateAdmin\('catalog'\)/);
  assert.match(source, /cityDirectoryEnabled && <button className="admin-cms-link"/);
});

test('organization owners never receive admin roles or management links', async () => {
  const roles = await readFile('src/admin/model.ts','utf8');
  const sql = await readFile('docs/sql/city-admin-mvp.sql','utf8');
  const profile = await readFile('src/pages/ProfilePage.tsx','utf8');
  const page = await readFile('src/admin/AdminPage.tsx','utf8');
  assert.match(roles,/AdminRole = 'owner' \| 'editor'/);
  assert.match(sql,/role IN \('owner', 'editor'\)/);
  assert.doesNotMatch(sql,/organization_owner|franchisee_user|business_owner/i);
  assert.doesNotMatch(profile,/Мои организации/);
  assert.match(profile,/canOpenAdmin/);
  assert.match(page,/directoryCategories/);
  assert.match(page,/categoryForOrganization/);
  assert.match(page,/validateAdminDraft\(draft, confirmed\)/);
});

test('admin sidebar reuses the official Ryadom brand image and returns to overview at top', async () => {
  const [admin, brand, desktop, css] = await Promise.all([
    readFile('src/admin/AdminPage.tsx', 'utf8'),
    readFile('src/components/BrandWordmark.tsx', 'utf8'),
    readFile('src/components/web/WebHeader.tsx', 'utf8'),
    readFile('src/admin/admin.css', 'utf8'),
  ]);
  assert.match(brand, /brand\/ryadom-logo-winter\.svg/);
  assert.match(desktop, /<BrandWordmark decorative\/>/);
  assert.match(admin, /<button type="button" className="admin-cms-wordmark"/);
  assert.match(admin, /<BrandWordmark decorative\/><\/button>/);
  assert.match(admin, /navigateAdmin\('overview'\); window\.scrollTo\(\{ top: 0, left: 0, behavior: 'instant' \}\)/);
  assert.doesNotMatch(admin, /РЯД<span>О<\/span>М/);
  assert.match(css, /\.admin-cms-wordmark \.brand-logo-image/);
  assert.match(css, /--brand-logo-width:120px/);
});

test('closing a business archives it; restoring does not publish it automatically', () => {
  assert.equal(nextAvailabilityStatus('published'), 'archived');
  assert.equal(nextAvailabilityStatus('draft'), 'archived');
  assert.equal(nextAvailabilityStatus('archived'), 'draft');
});

test('delete control calls the protected permanent-delete RPC instead of archiving', async () => {
 const panel=await readFile('src/admin/AdminPage.tsx','utf8'),repo=await readFile('src/admin/repository.ts','utf8');
 assert.match(panel,/className="admin-cms-card-action"/);assert.match(panel,/window\.confirm\(/);
 assert.match(panel,/void removeOrganization\(row\)/);assert.doesNotMatch(panel,/toggleAvailability/);
 assert.match(repo,/rpc\('delete_organization'/);assert.match(repo,/p_expected_updated_at:row.updated_at/);
});

test('location pin coordinates are optional, paired, validated and preserved in admin drafts', async () => {
  assert.deepEqual(validateAdminDraft(draft, false), {});
  assert.ok(validateAdminDraft({ ...draft, latitude: '58.4', longitude: '' }, false).latitude);
  assert.ok(validateAdminDraft({ ...draft, latitude: '', longitude: '92.2' }, false).latitude);
  assert.ok(validateAdminDraft({ ...draft, latitude: '99', longitude: '92' }, false).latitude);
  assert.ok(validateAdminDraft({ ...draft, latitude: '58', longitude: '-200' }, false).longitude);
  assert.ok(validateAdminDraft({ ...draft, latitude: 'NaN', longitude: '92' }, false).latitude);
  assert.ok(validateAdminDraft({ ...draft, latitude: '58\\\\d', longitude: '92' }, false).latitude);
  assert.deepEqual(validateAdminDraft({ ...draft, latitude: '58,44', longitude: '92.15' }, false), {});
  assert.deepEqual(validateAdminDraft({ ...draft, latitude: '0', longitude: '0' }, false), {});
  const row = { id:'place-a', city:'Енисейск', kind:'places', title:'Кафе', category:'Кафе',
    description:'Пример', latitude:58.45, longitude:92.2, address:'', phone:'', hours:'', website:null,
    vk_url:null,source_url:null,image_url:null,status:'published',verified_at:'2026-10-14',
    source_type:'manual_verified',created_at:'',updated_at:'' };
  const converted = rowToAdminDraft(row);
  assert.equal(converted.latitude, '58.45');
  assert.equal(converted.longitude, '92.2');
  const page = await readFile('src/admin/AdminPage.tsx', 'utf8');
  const repo = await readFile('src/admin/repository.ts', 'utf8');
  const grant = await readFile('docs/sql/admin-map-coordinates-2026-10.sql', 'utf8');
  assert.ok(page.includes("onChange={event => change('latitude',event.target.value)}"));
  assert.ok(page.includes("onChange={event => change('longitude',event.target.value)}"));
  assert.ok(repo.includes("latitude: draft.latitude.trim() ? Number("));
  assert.ok(repo.includes("longitude: draft.longitude.trim() ? Number("));
  assert.ok(grant.includes("GRANT UPDATE (latitude, longitude) ON public.organizations TO authenticated"));
});
