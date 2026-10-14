import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRutubeVideo } from '../src/media/rutube.ts';

const id = '7716bd3e665725c3c008ae7ab4ff02e2';
const expected = {
  id, watchUrl: 'https://rutube.ru/video/' + id + '/',
  embedUrl: 'https://rutube.ru/play/embed/' + id,
};
for (const url of [
  'https://rutube.ru/video/' + id + '/',
  'https://www.rutube.ru/shorts/' + id + '/',
  'https://rutube.ru/play/embed/' + id,
]) {
  test('normalizes approved RUTUBE video URL ' + url, () => {
    assert.deepEqual(parseRutubeVideo(url), expected);
  });
}

for (const url of [
  '', 'not-a-url', 'http://rutube.ru/video/' + id + '/',
  'https://rutube.ru.evil.test/video/' + id + '/',
  'https://evil.test/rutube.ru/video/' + id,
  'https://user:pass@rutube.ru/video/' + id + '/',
  'https://rutube.ru:444/video/' + id + '/',
  'https://rutube.ru/video/' + id + '/?a=1',
  'https://rutube.ru/video/' + id + '/#anchor',
  'https://rutube.ru/video/private/' + id + '/?p=secret',
  'https://rutube.ru/play/embed/' + id + '/?p=secret',
  'https://rutube.ru/video/../../bad',
  'https://youtube.com/watch?v=123',
  '<iframe src="https://rutube.ru/play/embed/' + id + '"></iframe>',
  'https://rutube.ru/video/abc123/',
]) {
  test('rejects unapproved media URL ' + url, () => {
    assert.equal(parseRutubeVideo(url), null);
  });
}
