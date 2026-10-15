import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getMine } from '../src/classifieds/repository.ts';

test('my classifieds query is scoped to authenticated owner AND selected city', async () => {
  for (const city of ['Енисейск', 'Лесосибирск']) {
    const calls = [];
    const query = {
      select(fields) { calls.push(['select', fields]); return this; },
      eq(column, value) { calls.push(['eq', column, value]); return this; },
      order(column, options) { calls.push(['order', column, options]); return this; },
      limit(count) { calls.push(['limit', count]); return Promise.resolve({ data: [], error: null }); },
    };
    const client = {
      from(table) { calls.push(['from', table]); assert.equal(table, 'classifieds'); return query; },
    };
    const results = await getMine(client, 'owner-123', city);
    assert.deepEqual(results, []);
    assert(calls.some(x => x[0] === 'eq' && x[1] === 'author_id' && x[2] === 'owner-123'));
    assert(calls.some(x => x[0] === 'eq' && x[1] === 'city' && x[2] === city));
    assert(calls.some(x => x[0] === 'order' && x[1] === 'created_at' && x[2]?.ascending === false));
    assert(calls.some(x => x[0] === 'limit' && x[1] === 100));
  }
});

test('the private my listings tab always passes the current city to the repository', async () => {
  const page = await readFile('src/classifieds/ClassifiedsPage.tsx', 'utf8');
  assert.match(page, /getMine\(supabase,userId,city\)/);
  assert.match(page, /classif(?:ieds)?SessionKey\(city,userId\)/i);
  assert.doesNotMatch(page, /getMine\(supabase,userId\)/);
});

test('a failed user-scoped query cannot be reported as an empty success', async () => {
  const query = {
    select() { return this; }, eq() { return this; }, order() { return this; },
    limit() { return Promise.resolve({data:null, error: {message:'Temporary connectivity error'}}); },
  };
  await assert.rejects(getMine({from:()=>query}, 'owner-123', 'Енисейск'), /Операция не выполнена/);
});
