import assert from 'node:assert/strict';
import test from 'node:test';
import { URL } from 'node:url';
import { placeMapLinks } from '../src/maps/placeMapLinks.ts';

test('coordinates preserve marker, viewport and coordinate route', () => {
  const links = placeMapLinks({ coordinates: { lat: 58.45, lon: 92.17 }, city: 'Енисейск', address: 'ул. Ленина, 1' });
  const maps = new URL(links.mapsUrl);
  assert.equal(maps.protocol, 'https:');
  assert.equal(maps.searchParams.get('ll'), '92.17,58.45');
  assert.equal(maps.searchParams.get('pt'), '92.17,58.45,pm2rdm');
  assert.equal(maps.searchParams.get('z'), '16');
  assert.equal(maps.searchParams.has('text'), false);
  const route = new URL(links.routeUrl);
  assert.equal(route.searchParams.get('rtext'), '~58.45,92.17');
  assert.equal(route.searchParams.get('rtt'), 'auto');
});

test('supplied yandexMapsUrl takes precedence over address fallback', () => {
  const yandexMapsUrl = 'https://yandex.ru/maps/?pt=92.17%2C58.45&z=16';
  const links = placeMapLinks({ yandexMapsUrl, city: 'Енисейск', address: 'ул. Ленина, 1' });
  assert.equal(links.mapsUrl, yandexMapsUrl);
  assert.equal(new URL(links.routeUrl).searchParams.get('rtext'), '~58.45,92.17');
});

test('supplied link without explicit destination does not route to fallback address', () => {
  const yandexMapsUrl = 'https://yandex.ru/maps/org/example/123/';
  const links = placeMapLinks({ yandexMapsUrl, city: 'Енисейск', address: 'ул. Ленина, 1' });
  assert.equal(links.mapsUrl, yandexMapsUrl);
  assert.equal(links.routeUrl, undefined);
});

test('supplied link plus coordinates retain the original link and coordinate route', () => {
  const yandexMapsUrl = 'https://maps.yandex.ru/?pt=90,55';
  const links = placeMapLinks({ yandexMapsUrl, coordinates: { lat: 58.45, lon: 92.17 }, city: 'Енисейск', address: 'ул. Ленина, 1' });
  assert.equal(links.mapsUrl, yandexMapsUrl);
  assert.equal(new URL(links.routeUrl).searchParams.get('rtext'), '~58.45,92.17');
});

test('city and address produce only HTTPS text search and textual route', () => {
  const links = placeMapLinks({ city: 'Енисейск', address: 'ул. Ленина, 1' });
  const maps = new URL(links.mapsUrl);
  const route = new URL(links.routeUrl);
  assert.equal(maps.origin, 'https://yandex.ru');
  assert.equal(maps.pathname, '/maps/');
  assert.equal(maps.searchParams.get('text'), 'Енисейск, ул. Ленина, 1');
  assert.deepEqual([...maps.searchParams.keys()], ['text']);
  assert.equal(route.origin, 'https://yandex.ru');
  assert.equal(route.searchParams.get('rtext'), '~Енисейск, ул. Ленина, 1');
  assert.equal(route.searchParams.get('rtt'), 'auto');
});

test('address without city has no fallback links', () => {
  for (const city of [undefined, '', '  ']) assert.deepEqual(placeMapLinks({ city, address: 'ул. Ленина, 1' }), { mapsUrl: undefined, routeUrl: undefined });
});

test('missing address has no fallback links', () => {
  for (const address of [undefined, '', '  ']) assert.deepEqual(placeMapLinks({ city: 'Енисейск', address }), { mapsUrl: undefined, routeUrl: undefined });
});

test('Cyrillic, spaces and reserved query characters round-trip without injection', () => {
  const city = 'Енисейск';
  const address = 'ул. Карла Маркса, 10 & корпус #2 + вход?';
  const links = placeMapLinks({ city, address });
  assert.ok(!links.mapsUrl.includes('Енисейск'));
  assert.ok(!links.mapsUrl.includes(' '));
  assert.ok(links.mapsUrl.includes('%D0'));
  assert.equal(new URL(links.mapsUrl).searchParams.get('text'), `${city}, ${address}`);
  assert.equal(new URL(links.routeUrl).searchParams.get('rtext'), `~${city}, ${address}`);
  assert.equal(new URL(links.mapsUrl).hash, '');
  assert.equal(new URL(links.mapsUrl).searchParams.size, 1);
});

test('route separators and control characters cannot create extra waypoints', () => {
  for (const address of ['ул. Ленина ~ площадь Мира', 'ул. Ленина\nдом 1']) {
    const links = placeMapLinks({ city: 'Енисейск', address });
    assert.equal(new URL(links.mapsUrl).searchParams.get('text'), `Енисейск, ${address}`);
    assert.equal(links.routeUrl, undefined);
  }
});

test('invalid supplied link cannot expose a non-Yandex URL', () => {
  for (const yandexMapsUrl of ['http://yandex.ru/maps/', 'https://yandex.ru.evil.example/maps/', 'javascript:alert(1)']) {
    const links = placeMapLinks({ yandexMapsUrl, city: 'Енисейск', address: 'ул. Ленина, 1' });
    assert.equal(new URL(links.mapsUrl).origin, 'https://yandex.ru');
    assert.equal(new URL(links.mapsUrl).searchParams.get('text'), 'Енисейск, ул. Ленина, 1');
  }
});
