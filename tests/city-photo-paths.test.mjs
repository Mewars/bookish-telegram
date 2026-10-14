import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storageCityPrefix, storageAdminPhotoKey } from '../src/admin/storagePaths.ts';

test('Russian city names are encoded as distinct ASCII-only Storage identifiers', () => {
  const first = storageCityPrefix('Енисейск');
  const second = storageCityPrefix('Лесосибирск');
  assert.match(first, /^city-[a-f0-9]+$/);
  assert.match(second, /^city-[a-f0-9]+$/);
  assert.notEqual(first, second);
  assert.equal(first, 'city-' + Buffer.from('Енисейск','utf8').toString('hex'));
});
test('object keys contain ASCII city and photo UUID with correct extension', () => {
  const name = storageAdminPhotoKey('Енисейск','12345678-1234-4234-8234-123456789012','webp');
  assert.match(name, /^city-[a-f0-9]+\/[a-f0-9-]+\.webp$/);
  assert.ok(name.split('').every(c => c.charCodeAt(0) < 128));
  assert.match(storageAdminPhotoKey('Енисейск','12345678-1234-4234-8234-123456789012','jpg'), /\.jpg$/);
  assert.throws(() => storageCityPrefix('Bad/City'), /Некорректное/);
  assert.throws(() => storageAdminPhotoKey('Енисейск','not-uuid','webp'), /Некорректный/);
});
