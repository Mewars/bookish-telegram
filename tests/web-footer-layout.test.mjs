import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('desktop footer keeps admin access in a discreet utility row without duplicate navigation', async () => {
  const footer = await readFile('src/components/web/WebFooter.tsx', 'utf8');
  const css = await readFile('src/styles/chrome.css', 'utf8');

  assert.match(footer, /className="web-footer-note"[\s\S]*className="footer-admin-link"/);
  assert.match(footer, /onClick=\{\(\) => navigate\('admin'\)\}/);
  assert.match(footer, /Административная панель/);
  assert.match(footer, /canOpenAdmin && <button/);
  assert.doesNotMatch(footer, /footer-navigation/);
  assert.match(footer, /<LegalLinks\s*\/>/);
  assert.match(footer, /<FooterCooperation showLegal=\{false\}/);

  assert.match(css, /\.web-footer-inner\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.15fr\)\s+minmax\(0,\s*\.95fr\)\s+minmax\(0,\s*1\.2fr\)/);
  assert.match(css, /\.footer-admin-link\s*\{[^}]*font-size:\s*11px/);
  assert.match(css, /\.footer-admin-link:focus-visible/);
  assert.match(css, /@media \(max-width:599px\)[\s\S]*\.footer-brand, \.web-footer \.footer-legal/);
});
