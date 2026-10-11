import assert from 'node:assert/strict';
import test from 'node:test';
import { openStreetMapUrls } from '../src/maps/openStreetMapUrls.ts';
import { placeMapLinks } from '../src/maps/placeMapLinks.ts';

test('OSM iframe has only supplied coordinates, map layer and a marker', () => {
  const point = { lat: 58.4535, lon: 92.176 };
  const urls = openStreetMapUrls(point);
  assert.ok(urls);
  const embed = new URL(urls.embedUrl);
  assert.equal(embed.origin, 'https://www.openstreetmap.org');
  assert.equal(embed.pathname, '/export/embed.html');
  assert.equal(embed.searchParams.get('marker'), '58.4535,92.176');
  assert.equal(embed.searchParams.get('layer'), 'mapnik');
  const [west, south, east, north] = embed.searchParams.get('bbox').split(',').map(Number);
  assert.ok(west < point.lon && point.lon < east);
  assert.ok(south < point.lat && point.lat < north);
  assert.deepEqual([...embed.searchParams.keys()], ['bbox', 'layer', 'marker']);

  const page = new URL(urls.pageUrl);
  assert.equal(page.origin, 'https://www.openstreetmap.org');
  assert.equal(page.searchParams.get('mlat'), '58.4535');
  assert.equal(page.searchParams.get('mlon'), '92.176');
  assert.equal(page.hash, '#map=16/58.4535/92.176');
});

test('no fabricated map when coordinates are absent or invalid', () => {
  for (const point of [undefined, null, { lat: NaN, lon: 92 }, { lat: 95, lon: 92 }, { lat: 88, lon: 92 }, { lat: 58, lon: Infinity }]) {
    assert.equal(openStreetMapUrls(point), undefined);
  }
});

test('bbox remains within supported world bounds near edges', () => {
  for (const point of [{ lat: -85, lon: -180 }, { lat: 85, lon: 180 }]) {
    const embed = new URL(openStreetMapUrls(point).embedUrl);
    const [west, south, east, north] = embed.searchParams.get('bbox').split(',').map(Number);
    assert.ok(west >= -180 && east <= 180 && south >= -85.05112878 && north <= 85.05112878);
    assert.ok(west < east && south < north);
  }
});

test('Yandex routes continue to be normal HTTPS links with no API key', () => {
  const point = { lat: 58.4535, lon: 92.176 };
  const { routeUrl, mapsUrl } = placeMapLinks({ coordinates: point, city: 'Енисейск' });
  assert.equal(new URL(routeUrl).origin, 'https://yandex.ru');
  assert.equal(new URL(routeUrl).searchParams.get('rtext'), '~58.4535,92.176');
  assert.equal(new URL(mapsUrl).origin, 'https://yandex.ru');
  assert.equal(new URL(routeUrl).searchParams.has('apikey'), false);
});
