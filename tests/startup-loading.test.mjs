import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { loadWithTimeout } from '../src/utils/loadWithTimeout.ts';

test('successful module loads without waiting for timeout', async () => {
  const module = { default: () => null };
  assert.equal(await loadWithTimeout(async () => module, 1000), module);
});

test('network/import rejection and synchronous loader errors remain actionable', async () => {
  const error = new Error('Failed to fetch dynamically imported module');
  await assert.rejects(loadWithTimeout(async () => { throw error; }, 1000), actual => actual === error);
  await assert.rejects(loadWithTimeout(() => { throw error; }, 1000), actual => actual === error);
});

test('a module that never responds settles with a timeout rather than infinite loading', async () => {
  await assert.rejects(loadWithTimeout(() => new Promise(() => {}), 5), /timed out/);
});

test('late completion cannot change a timed-out load into success', async () => {
  let complete;
  const pending = loadWithTimeout(() => new Promise(resolve => { complete = resolve; }), 5);
  await assert.rejects(pending, /timed out/);
  complete({ default: () => null });
  await setTimeout(0);
  await assert.rejects(pending, /timed out/);
});
