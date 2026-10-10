import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_CSV_BYTES, checkFileSize, csvTemplate, parseOrganizationCsv } from '../src/import/csv.ts';
import { exportRecords, validateRows } from '../src/import/validation.ts';
const base = 'Название;Город;Категория;Источник;Тип источника;Дата проверки\nКафе;Енисейск;Кафе;https://example.ru;official_website;2026-10-10';
const parse = text => parseOrganizationCsv(text).rows;
const row = (values = {}) => ({ number: 2, structuralErrors: [], draft: {
  title: 'Кафе', city: 'Енисейск', category: 'Кафе', address: '', phone: '', hours: '', website: '',
  vkUrl: '', description: '', lat: '', lon: '', sourceUrl: 'https://example.ru', sourceType: 'official_website', verifiedAt: '2026-10-10', ...values,
} });
const check = values => validateRows([row(values)])[0];
test('Russian UTF-8, semicolon, BOM, CRLF and LF', () => {
  for (const text of [base, '\uFEFF' + base.replaceAll('\n', '\r\n')]) {
    const result = parseOrganizationCsv(text);
    assert.equal(result.delimiter, ';'); assert.equal(result.rows[0].draft.title, 'Кафе');
    assert.equal(validateRows(result.rows)[0].status, 'ready');
  }
});
test('comma delimiter, case insensitive machine names, whitespace, quotes and multiline fields', () => {
  const result = parseOrganizationCsv(' TITLE ,CITY,category,sourceUrl,sourceType,description,phone\r\n"Кафе; рядом",Енисейск,Кафе,https://example.ru,owner_provided,"Текст, с ; и ""кавычками""\nновая строка", 8 (391) 123-45-67 ');
  assert.equal(result.delimiter, ',');
  assert.equal(result.rows[0].draft.description, 'Текст, с ; и "кавычками"\nновая строка');
  assert.equal(result.rows[0].draft.phone, '8 (391) 123-45-67');
});
test('empty, header-only, invalid quotes, missing or duplicate headers', () => {
  for (const text of ['', '\uFEFF \n', base.split('\n')[0], 'foo;bar\nx;y', base.replace('Город', 'Название'), base + '\n"unfinished']) assert.throws(() => parse(text));
});
test('missing required values and unknown source type are fatal', () => {
  for (const key of ['title', 'city', 'category', 'sourceUrl', 'sourceType']) assert.equal(check({ [key]: '' }).status, 'error');
  for (const sourceType of ['2gis', 'yandex_maps', 'google_maps', '__proto__', 'unknown']) assert.equal(check({ sourceType }).status, 'error');
});
test('URL syntax, protocols, VK hostname boundaries and HTTP warnings', () => {
  for (const key of ['website', 'vkUrl', 'sourceUrl']) for (const value of ['javascript:alert(1)', 'ftp://example.ru', '//example.ru', 'https://', 'https://example.ru/a b']) assert.equal(check({ [key]: value }).status, 'error');
  for (const vkUrl of ['https://vk.com/id1', 'https://m.vk.com/id1', 'https://vk.ru/id1']) assert.equal(check({ vkUrl }).status, 'ready');
  for (const vkUrl of ['https://evilvk.com', 'https://vk.com.evil.example', 'https://vk.com@evil.example']) assert.equal(check({ vkUrl }).status, 'error');
  assert.equal(check({ website: 'http://example.ru' }).status, 'warning');
});
test('optional coordinate pair, range, numeric syntax and zero coordinates', () => {
  assert.equal(check({}).status, 'ready');
  for (const values of [{ lat: '58' }, { lon: '92' }, { lat: '91', lon: '92' }, { lat: '58', lon: '-181' }, { lat: 'NaN', lon: '92' }, { lat: '0x10', lon: '92' }, { lat: '58,45', lon: '92' }]) assert.equal(check(values).status, 'error');
  assert.deepEqual(exportRecords([row({ lat: '0', lon: '0' })])[0].coordinates, { lat: 0, lon: 0 });
});
test('verifiedAt warning, real calendar date and no automatic date', () => {
  assert.equal(check({ verifiedAt: '' }).status, 'warning');
  for (const verifiedAt of ['2026-02-29', '2026-13-01', '10.10.2026', '2026-1-1']) assert.equal(check({ verifiedAt }).status, 'error');
  assert.equal(check({ verifiedAt: '2024-02-29' }).status, 'ready');
  assert.ok(!Object.hasOwn(exportRecords([row({ verifiedAt: '' })])[0], 'verifiedAt'));
});
test('duplicates warn both rows, normalize case/space, and recalculate after edits', () => {
  const first = row({ title: ' КАФЕ  РЯДОМ ', address: 'Ул. Мира, 1' });
  const second = { ...row({ title: 'кафе рядом', address: 'ул. мира, 1' }), number: 3 };
  assert.deepEqual(validateRows([first, second]).map(value => value.duplicate), [true, true]);
  second.draft.address = 'Ул. Мира, 2';
  assert.deepEqual(validateRows([first, second]).map(value => value.duplicate), [false, false]);
  second.draft.address = '';
  assert.deepEqual(validateRows([first, second]).map(value => value.duplicate), [true, true]);
  assert.equal(exportRecords([first, second]).length, 2);
});
test('5 MB boundary', () => {
  assert.doesNotThrow(() => checkFileSize(MAX_CSV_BYTES));
  assert.throws(() => checkFileSize(MAX_CSV_BYTES + 1), /5 MB/);
});
test('JSON omits empty optional fields, filters fatal rows, preserves phone and text without execution', () => {
  const good = row({ title: '<script>alert(1)</script>', phone: '  +7 (391) 123-45-67  ', description: '=HYPERLINK("https://evil.example")' });
  const records = JSON.parse(JSON.stringify(exportRecords([good, row({ sourceUrl: '' })])));
  assert.equal(records.length, 1);
  assert.equal(records[0].title, '<script>alert(1)</script>');
  assert.equal(records[0].phone, '+7 (391) 123-45-67');
  for (const key of ['address', 'hours', 'website', 'vkUrl', 'coordinates', 'imageUrl', 'photoUrl']) assert.ok(!Object.hasOwn(records[0], key));
});
test('template has 14 correctly aligned columns and a valid demonstration row', () => {
  const rows = parse(csvTemplate());
  assert.equal(rows[0].draft.sourceUrl, 'https://example.ru');
  assert.equal(rows[0].draft.sourceType, 'official_website');
  assert.equal(validateRows(rows)[0].status, 'ready');
});
test('column count mismatch is fatal until the row is reviewed in editor', () => {
  const rows = parse(base + ';unexpected');
  assert.equal(validateRows(rows)[0].status, 'error');
  assert.equal(exportRecords(rows).length, 0);
  assert.equal(validateRows(rows.map(value => ({ ...value, structuralErrors: [] })))[0].status, 'ready');
});
