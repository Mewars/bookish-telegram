import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifiedsSessionKey } from '../src/classifieds/sessionKey.ts';

test('private beta cache is scoped to city and account', () => {
  const guest = classifiedsSessionKey('Енисейск', null);
  const alice = classifiedsSessionKey('Енисейск', 'alice');
  const bob = classifiedsSessionKey('Енисейск', 'bob');
  const otherCity = classifiedsSessionKey('Лесосибирск', 'alice');
  assert.notEqual(guest, alice);
  assert.notEqual(alice, bob);
  assert.notEqual(alice, otherCity);
  assert.equal(alice, classifiedsSessionKey('Енисейск', 'alice'));
  assert.notEqual(classifiedsSessionKey('a|b', 'c'), classifiedsSessionKey('a', 'b|c'));
});
