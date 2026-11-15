import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = path => readFile(new URL('../' + path, import.meta.url));
const tag = '?v=vstrechay4';

test('browser favicon is a large plain gold pin in ICO, PNG and SVG formats', async () => {
  const [ico, svgBytes, htmlBytes] = await Promise.all([
    read('public/favicon.ico'),
    read('public/brand/vstrechay-pin-favicon.svg'),
    read('index.html')
  ]);
  const svg = svgBytes.toString('utf8');
  const html = htmlBytes.toString('utf8');
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (const [index, size] of [16, 32, 48].entries()) {
    const offset = 6 + index * 16;
    assert.equal(ico[offset], size);
    assert.equal(ico[offset + 1], size);
    const length = ico.readUInt32LE(offset + 8);
    const start = ico.readUInt32LE(offset + 12);
    const insideIco = ico.subarray(start, start + length);
    const png = await read('public/brand/vstrechay-icon-' + size + '.png');
    assert.deepEqual(insideIco, png, size + 'px: ICO should match the plain PNG');
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert(png.includes(Buffer.from('tRNS')), 'Icon must have transparent background');
  }
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.match(svg, /aria-label="Геометка Встречай"/);
  assert.match(svg, /<path /);
  assert.doesNotMatch(svg, /Santa|hat|шапк|<image/i);
  assert(html.includes('/favicon.ico' + tag));
  assert(html.includes('/brand/vstrechay-icon-32.png' + tag));
  assert(html.includes('/brand/vstrechay-pin-favicon.svg' + tag));
});

test('standalone public pages use the fresh plain-pin icon', async () => {
  for (const path of ['host-public/wall/index.html', 'host-public/classifieds/index.html', 'host-public/donate/index.html', 'public/stories-preview/index.html']) {
    const html = (await read(path)).toString('utf8');
    assert(html.includes('/brand/vstrechay-pin-favicon.svg' + tag), path);
    assert(!html.includes('vstrechay-pin-favicon.svg?v=vstrechay3'), path);
  }
});
