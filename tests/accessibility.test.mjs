import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  ACCESSIBILITY_STORAGE_KEY,
  DEFAULT_ACCESSIBILITY,
  parseAccessibilityPreferences,
} from '../src/accessibility/preferences.ts';

test('accessibility settings have safe defaults and a versioned local preference key', () => {
  assert.equal(ACCESSIBILITY_STORAGE_KEY, 'ryadom.accessibility.v1');
  assert.deepEqual(parseAccessibilityPreferences(null), DEFAULT_ACCESSIBILITY);
  assert.deepEqual(parseAccessibilityPreferences('not-json'), DEFAULT_ACCESSIBILITY);
  assert.deepEqual(parseAccessibilityPreferences('[]'), DEFAULT_ACCESSIBILITY);
});

test('valid preferences persist, but unexpected data or values cannot inject styling tokens', () => {
  assert.deepEqual(parseAccessibilityPreferences(JSON.stringify({
    textSize: 'extra', highContrast: true, reduceMotion: true,
    hearingAssistance: true, untrusted: 'ignored',
  })), { textSize: 'extra', highContrast: true, reduceMotion: true, hearingAssistance: true });
  assert.deepEqual(parseAccessibilityPreferences(JSON.stringify({
    textSize: 'large; color: red', highContrast: 'true',
    reduceMotion: 1, hearingAssistance: null,
  })), DEFAULT_ACCESSIBILITY);
});

test('desktop and mobile have a keyboard accessible AA launcher and modal', async () => {
  const app = await readFile('src/App.tsx','utf8');
  const header = await readFile('src/components/web/WebHeader.tsx','utf8');
  const panel = await readFile('src/accessibility/AccessibilityPanel.tsx','utf8');
  const css = await readFile('src/accessibility/accessibility.css','utf8');
  assert.doesNotMatch(header,/AccessibilityButton/);
  assert.ok(app.includes('<AccessibilityButton onClick={() => setAccessibilityOpen(true)}/>'));
  assert.match(css, /\.accessibility-button--fixed/);
  assert.match(app,/<AccessibilityPanel open=\{accessibilityOpen\}/);
  assert.match(panel,/aria-label="Версия для слабовидящих и слабослышащих/);
  assert.match(panel,/aria-haspopup="dialog"/);
  assert.match(panel,/dialog\?\.showModal\(\)/);
  assert.match(panel,/onCancel=\{event => \{ event.preventDefault\(\); onClose\(\); \}\}/);
  assert.match(panel,/onReset\(\)/);
  assert.match(panel,/aria-pressed=\{preferences.textSize === option.id\}/);
});

test('contrast, hearing and reduced-motion settings are rendered from controlled preferences', async () => {
  const hook = await readFile('src/accessibility/useAccessibility.ts','utf8');
  const css = await readFile('src/accessibility/accessibility.css','utf8');
  const music = await readFile('src/music/MusicPlayer.tsx','utf8');
  const web = await readFile('src/styles/chrome.css','utf8');
  assert.match(hook,/root.dataset.a11yText = preferences.textSize/);
  assert.match(hook,/root.dataset.a11yContrast = preferences.highContrast/);
  assert.match(hook,/root.dataset.a11yMotion = preferences.reduceMotion/);
  assert.match(hook,/root.dataset.a11yHearing = preferences.hearingAssistance/);
  assert.match(css,/:root\[data-a11y-contrast=high\]/);
  assert.match(css,/:root\[data-a11y-motion=reduce\]/);
  assert.match(css,/:root\[data-a11y-text=extra\]/);
  assert.match(css,/\.web-nav button \{ font-size: 15px;/);
  assert.match(music,/return null/);
  assert.match(css,/data-a11y-hearing=on/);
  assert.match(web,/\.web-nav button \{ position:/);
});

test('owner contact page and fixed launcher keep requested legal and mobile behavior', async () => {
  const [contacts, links, stylesheet, home] = await Promise.all([
    readFile('src/pages/OperatorContactsPage.tsx', 'utf8'),
    readFile('src/components/legal/LegalLinks.tsx', 'utf8'),
    readFile('src/accessibility/accessibility.css', 'utf8'),
    readFile('src/components/CityHome.tsx', 'utf8'),
  ]);
  assert.match(contacts, /Контакты владельца/);
  assert.match(contacts, /Владелец сервиса/);
  assert.match(contacts, /https:\/\/vk\.ru\/mewarspro/);
  assert.match(links, /Контакты владельца/);
  assert.match(stylesheet, /position: fixed; right: 16px; bottom:/);
  assert.match(stylesheet, /bottom: calc\(94px \+ env\(safe-area-inset-bottom/);
  assert.doesNotMatch(home, /className="city-selections-backdrop"/);
});
