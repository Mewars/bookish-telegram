import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { URLSearchParams } from 'node:url';
import { getCityCover } from '../src/data/cityCover.ts';

const html = await readFile('index.html', 'utf8');
const source = html.match(/<script id="city-cover-preload">([\s\S]*?)<\/script>/)[1].replaceAll('%BASE_URL%', '/');
function preload(hash, stored, now, denied = false) {
  const links = [];
  vm.runInNewContext(source, {
    window: { location: { hash } },
    localStorage: { getItem() { if (denied) throw Error('Blocked'); return stored; } },
    URLSearchParams, Intl,
    Date: class extends Date { constructor() { super(now); } },
    document: { createElement: () => ({}), head: { appendChild: link => links.push(link) } },
  });
  return links;
}

test('early cover preload matches the rendered city and lamps at every hour', () => {
  for (const city of ['Енисейск', 'Лесосибирск', 'Красноярск']) {
    for (let hour = 0; hour < 24; hour++) {
      const now = new Date(`2026-11-14T${String(hour).padStart(2, '0')}:00:00+07:00`);
      for (const [hash, stored] of [['#/home', JSON.stringify(city)], [`#/home?city=${encodeURIComponent(city)}`, '"Other city"']]) {
        const [link] = preload(hash, stored, now);
        assert.equal(link.href, getCityCover(city, null, now).src);
        assert.equal(link.as, 'image');
        assert.equal(link.fetchPriority, 'high');
      }
    }
  }
});

test('private routes and unknown cities do not download a homepage cover', () => {
  const now = new Date('2026-11-14T10:00:00+07:00');
  for (const hash of ['#/places', '#/places/card', '#/profile', '#/login', '#/admin', '#/home?city=Unknown']) {
    assert.equal(preload(hash, null, now).length, 0);
  }
  assert.equal(preload('#/home', '"Unknown"', now).length, 0);
  for (const hash of ['', '#/', '#/home']) {
    assert.equal(preload(hash, null, now, true)[0].href, getCityCover('Енисейск', null, now).src);
  }
});
