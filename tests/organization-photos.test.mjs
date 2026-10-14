import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const file = path => readFile(path, 'utf8');

test('all 25 organization cards have a photo, including the original monastery image', async () => {
  const photoCode = await file('src/data/organizationPhotos.ts');
  const placesCode = await file('src/data/places.ts');
  const verifiedCode = await file('src/data/verifiedEniseysk.ts');
  const ids = [...placesCode.matchAll(/\bid: '([^']+)'/g), ...verifiedCode.matchAll(/\bid: '([^']+)'/g)].map(x => x[1]);
  const photoIds = [...photoCode.matchAll(/^\s+'(place-[^']+|service-[^']+)': \{/gm)].map(x => x[1]);
  assert.equal(ids.length, 25);
  assert.equal(photoIds.length, 24);
  assert.equal(new Set(ids).size, 25);
  assert.equal(new Set(photoIds).size, 24);
  assert.ok(placesCode.includes("id: 'place-spassky-monastery'"));
  assert.ok(placesCode.includes("image: '/spassky-monastery-eniseysk.webp'"));
  for (const id of ids) {
    if (id === 'place-spassky-monastery') continue;
    assert.ok(photoIds.includes(id), 'No photo: ' + id);
  }
});

test('stock photos are honestly labelled; verified real library photo includes license credits', async () => {
  const code = await file('src/data/organizationPhotos.ts');
  const card = await file('src/components/Card.tsx');
  const detail = await file('src/pages/DetailPage.tsx');
  const entries = [...code.matchAll(/^\s+'(place-[^']+|service-[^']+)': \{([\s\S]*?)^  \},/gm)];
  assert.equal(entries.length, 24);
  for (const [, id, metadata] of entries) {
    assert.match(metadata, /image: 'https:\/\//, 'Remote photo should use HTTPS: ' + id);
    assert.match(metadata, /photoSourceUrl: 'https:\/\//, 'Photo source missing: ' + id);
    if (id === 'place-central-library') {
      assert.match(metadata, /photoIllustrative: false/);
      assert.match(metadata, /creativecommons\.org\/licenses\/by-sa\/4\.0/);
      assert.match(metadata, /Маркова/);
    } else {
      assert.match(metadata, /photoIllustrative: true/);
      assert.match(metadata, /images\.unsplash\.com/);
    }
  }
  assert.match(card, /Фото-иллюстрация/);
  assert.match(detail, /Тематическая фотография, не снимок этой организации/);
  assert.match(detail, /photoSourceUrl/);
  assert.match(detail, /photoLicenseUrl/);
  const merge = await file('src/organizations/model.ts');
  assert.match(merge, /photoIllustrative: ownerPhoto \? false/);
});

test('catalog decorates photographs without inventing new directory entries', async () => {
  const catalog = await file('src/data/catalog.ts');
  assert.match(catalog, /\.map\(withDirectoryPhoto\)/);
  assert.match(catalog, /\.\.\.places, \.\.\.verifiedEniseyskPlaces, \.\.\.verifiedEniseyskServices/);
});
