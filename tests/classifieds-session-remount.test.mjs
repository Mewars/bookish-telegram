import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('beta private state is owned by the keyed session component', async () => {
  const page = await readFile('src/classifieds/ClassifiedsPage.tsx', 'utf8');
  const wrapper = page.indexOf('export function ClassifiedsPage(');
  const child = page.indexOf('function ClassifiedsSession(');
  assert.ok(wrapper >= 0 && child > wrapper);
  assert.match(page.slice(wrapper, child), /key=\{JSON\.stringify\(\[city,userId\]\)\}/);
  for (const state of ['threads', 'messages', 'reports', 'blockedUsers', 'threadId', 'messageDraft', 'draft', 'canReview']) {
    assert.match(page.slice(child), new RegExp('const \\[\\s*' + state + '\\s*,'));
  }
});
