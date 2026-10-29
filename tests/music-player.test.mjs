import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

test('radio entry cannot restore direct streaming or a hidden player', async () => {
  const files = await readdir('src/music');
  const source = (await Promise.all(files.map(file => readFile(`src/music/${file}`, 'utf8')))).join('\n');
  assert.doesNotMatch(source, /hostingradio\.ru|\.aacp|new Audio\s*\(|<audio|<iframe|fetch\s*\(/);
  const app = await readFile('src/App.tsx', 'utf8');
  const application = await readFile('src/PublicApplication.tsx', 'utf8');
  assert.doesNotMatch(app, /<MusicPlayer/);
  assert.doesNotMatch(application, /MusicProvider/);
});
