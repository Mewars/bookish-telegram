import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APPLICATION_CONSENT_VERSION, emptyDraft, featureEnabled, mergePublished, normalizeDraft, statusLabels, validateDraft } from '../src/organizations/model.ts';
import { readPublished, readApplications, submitApplication, withDeadline } from '../src/organizations/repository.ts';

const draft = { ...emptyDraft('Енисейск'), title: 'Музей', category: 'Музеи', address: 'ул. Ленина, 106', description: 'Сведения для теста, не публикуются.', source_note: 'Источник для теста.' };
const local = [{ id: 'place-museum', city: 'Енисейск', kind: 'places', title: 'Музей', category: 'Музеи', address: draft.address, description: 'Локальный текст', image: '/existing.svg', real: true }, { id: 'event', city: 'Енисейск', kind: 'events', title: 'Событие', image: '/event.svg' }];
const row = { id: 'place-museum', city: 'Енисейск', title: 'Музей', category: 'Музеи', description: 'Проверенный текст', address: draft.address, phone: null, hours: null, website: null, vk_url: null, latitude: null, longitude: null, source_type: 'user_provided', source_url: null, verified_at: '2026-10-06', status: 'published', created_at: '2026-10-06T00:00:00Z', updated_at: '2026-10-06T00:00:00Z' };
function fakeClient(responses, userId = 'user-a') {
  const calls = []; const queue = [...responses];
  const client = {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from(table) {
      calls.push(['from', table]);
      const builder = {};
      for (const method of ['select', 'eq', 'order', 'range', 'abortSignal', 'single', 'insert']) builder[method] = (...args) => { calls.push([method, ...args]); return builder; };
      builder.then = (resolve, reject) => Promise.resolve(queue.shift() ?? { error: null, data: [] }).then(resolve, reject);
      return builder;
    },
  };
  return { client, calls };
}

test('flag defaults off, HTTPS required except local development', () => {
  for (const flag of [undefined, '', 'false', 'TRUE', '1']) assert.equal(featureEnabled(flag, 'https:', 'ryadomcity.ru', false), false);
  assert.equal(featureEnabled('true', 'https:', 'ryadomcity.ru', false), true);
  assert.equal(featureEnabled('true', 'http:', 'ryadomcity.ru', true), false);
  assert.equal(featureEnabled('true', 'http:', 'localhost', false), false);
  assert.equal(featureEnabled('true', 'http:', 'localhost', true), true);
});
test('required fields, length, consent and whitespace validation', () => {
  assert.deepEqual(validateDraft(draft, true), {});
  const invalid = validateDraft({ ...emptyDraft(' '), title: 'x'.repeat(161) }, false);
  for (const key of ['title','city','category','address','description','source_note','consent']) assert.ok(invalid[key]);
  assert.ok(validateDraft({ ...draft, description: '\u0001' }, true).description);
  assert.ok(validateDraft({ ...draft, source_note: 'x'.repeat(1001) }, true).source_note);
});
test('phone and unsafe or invalid website/VK values are rejected', () => {
  assert.ok(validateDraft({ ...draft, phone: 'call me' }, true).phone);
  for (const website of ['javascript:alert(1)', 'http://example.org', 'https://user:pass@example.org', 'data:text/html,test']) assert.ok(validateDraft({ ...draft, website }, true).website);
  assert.ok(validateDraft({ ...draft, vk_url: 'https://evil.org/vk.com' }, true).vk_url);
  assert.equal(normalizeDraft({ ...draft, vk_url: 'HTTPS://VK.COM/test' }).vk_url, 'https://vk.com/test');
  assert.ok(validateDraft({ ...draft, website: 'https://example.org/' + 'я'.repeat(100) }, true).website);
  assert.deepEqual(validateDraft({ ...draft, phone: '+7 (991) 438-83-80', website: 'https://example.org', vk_url: 'https://vk.com/test' }, true), {});
});
test('pending/archived records never enter catalog, no response preserves local baseline', () => {
  assert.deepEqual(mergePublished(local, [], '/fallback.svg'), local);
  assert.deepEqual(mergePublished(local, [{ ...row, status: 'draft' }, { ...row, status: 'archived' }], '/fallback.svg'), local);
});
test('published records deduplicate by legacy ID and normalized city/title/address', () => {
  const merged = mergePublished(local, [row, row, { ...row, id: 'different-server-id', title: ' МУЗЕЙ ', address: ' ул. Ленина, 106 ' }], '/fallback.svg');
  assert.equal(merged.length, local.length);
  assert.equal(merged[0].id, local[0].id);
  assert.equal(merged[0].image, local[0].image);
  assert.deepEqual(merged[1], local[1]);
});
test('new published organization is searchable Item without invented photos, ratings or coordinates', () => {
  const item = mergePublished(local, [{ ...row, id: 'new', title: 'Новое место', website: 'javascript:alert(1)', latitude: 91, longitude: 30 }], '/fallback.svg').at(-1);
  assert.equal(item.id, 'new'); assert.equal(item.kind, 'places'); assert.equal(item.real, true);
  assert.equal(item.image, '/fallback.svg'); assert.equal(item.coordinates, undefined); assert.equal(item.rating, undefined); assert.equal(item.website, undefined);
  const valid = mergePublished([], [{ ...row, latitude: 58.449, longitude: 92.179 }], '/fallback.svg')[0];
  assert.deepEqual(valid.coordinates, { lat: 58.449, lon: 92.179 });
});
test('published query explicitly filters status and handles unavailable/missing backend', async () => {
  const { client, calls } = fakeClient([{ data: [row], error: null }]);
  assert.deepEqual(await readPublished(client), [row]);
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'status' && call[2] === 'published'));
  await assert.rejects(readPublished(null));
  await assert.rejects(readPublished(fakeClient([{ error: { message: 'offline' }, data: null }]).client));
  await assert.rejects(withDeadline(() => new Promise(() => {}), 5), /соединиться/);
});
test('published query paginates beyond backend row limit', async () => {
  const page = Array.from({ length: 500 }, (_, i) => ({ ...row, id: `id-${i}` }));
  const { client } = fakeClient([{ data: page, error: null }, { data: [row], error: null }]);
  assert.equal((await readPublished(client)).length, 501);
});
test('own applications guard verified session and filter foreign rows defensively', async () => {
  const mine = { ...draft, id: 'application-a', applicant_id: 'user-a', status: 'pending' };
  const other = { ...mine, id: 'application-b', applicant_id: 'user-b' };
  const { client, calls } = fakeClient([{ data: [mine, other], error: null }]);
  assert.deepEqual(await readApplications(client, 'user-a'), [mine]);
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'applicant_id' && call[2] === 'user-a'));
  await assert.rejects(readApplications(fakeClient([], 'user-b').client, 'user-a'), /Сессия/);
  await assert.rejects(readApplications(fakeClient([{ data: null, error: { message: 'offline' } }]).client, 'user-a'));
});
test('submission sends no status/admin/publication fields and requires explicit consent', async () => {
  const { client, calls } = fakeClient([{ data: { ...draft, id: 'a', status: 'pending' }, error: null }]);
  await submitApplication(client, 'user-a', { ...draft, title: ' Музей ' }, true, 'request-a');
  const payload = calls.find(call => call[0] === 'insert')[1];
  assert.equal(payload.title, 'Музей'); assert.equal(payload.applicant_id, 'user-a'); assert.equal(payload.consent_version, APPLICATION_CONSENT_VERSION);
  for (const key of ['status','organization_id','review_message','consented_at','created_at','role']) assert.equal(key in payload, false);
  await assert.rejects(submitApplication(client, 'user-a', draft, false, 'request-b'), /согласие/);
});
test('duplicate retry recovers only same payload and never overwrites accepted application', async () => {
  const accepted = { ...draft, id: 'accepted', applicant_id: 'user-a', status: 'pending' };
  assert.equal((await submitApplication(fakeClient([{ error: { code: '23505' } }, { data: accepted, error: null }]).client, 'user-a', draft, true, 'retry')).id, 'accepted');
  await assert.rejects(submitApplication(fakeClient([{ error: { code: '23505' } }, { data: { ...accepted, title: 'Other' }, error: null }]).client, 'user-a', draft, true, 'retry'), /Предыдущая отправка/);
});
test('status labels and private SEO screens do not invent verification or canonical', async () => {
  assert.deepEqual(Object.keys(statusLabels), ['pending','approved','rejected']);
  const { pageMetadata } = await import('../src/seo/metadata.ts');
  for (const section of ['add-organization','my-applications','organization-consent']) assert.equal(pageMetadata(section).canonical, undefined);
});
