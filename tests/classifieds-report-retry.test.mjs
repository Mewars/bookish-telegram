import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { submitClassifiedReport } from '../src/classifieds/repository.ts';

test('transient complaint write failure preserves the ability to resubmit the same report', async () => {
  const submissions = [];
  const client = {
    from(table) {
      assert.equal(table, 'classified_reports');
      return {
        async insert(payload) {
          submissions.push(payload);
          return { error: submissions.length === 1 ? { message: 'Temporary failure' } : null };
        },
      };
    },
  };
  const listingId = 'sample-listing-id';
  const reason = 'Проверяем отправку жалобы после временного сбоя.';
  await assert.rejects(submitClassifiedReport(client, listingId, reason), /Операция не выполнена/);
  await assert.doesNotReject(submitClassifiedReport(client, listingId, reason));
  assert.deepEqual(submissions, [
    { listing_id: listingId, reason },
    { listing_id: listingId, reason },
  ]);
});

test('complaint form retains its text and does not treat a failed send as success', async () => {
  const control = await readFile('src/classifieds/ClassifiedReportControl.tsx', 'utf8');
  assert.match(control, /\[result,setResult\]=useState\(''\)/);
  assert.match(control, /\[error,setError\]=useState\(''\)/);
  assert.match(control, /expanded && !result && <form/);
  assert.match(control, /setError\(''\);\s*setSending\(true\)/);
  assert.match(control, /\.then\(\(\)=>\{\s*setResult\(/);
  assert.match(control, /\.catch\(reason=>\{\s*setError\(/);
  assert.doesNotMatch(control, /\.catch\([^\n]+=>setResult\(/);
  assert.match(control, /value=\{reason\}/);
  assert.match(control, /\{error && <p role="alert"/);
  assert.match(control, /\.finally\(\(\)=>setSending\(false\)\)/);
});
