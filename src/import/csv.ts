import { importFields, type ImportField, type ImportRow, type OrganizationDraft } from './types';
export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export function checkFileSize(size: number) {
  if (size > MAX_CSV_BYTES) throw new Error('Файл больше 5 MB. Выберите CSV меньшего размера.');
}
const normalizeHeader = (value: string) => value.replace(/\s+/g, '').toLowerCase();
const headers = new Map<string, ImportField>(importFields.flatMap(([key, label]) => [
  [normalizeHeader(key), key], [normalizeHeader(label), key],
]));
const required: ImportField[] = ['title', 'city', 'category', 'sourceUrl', 'sourceType'];

// A small state machine: quoted delimiters, escaped quotes and multiline fields
// remain text. Malformed quoting is rejected rather than silently shifting columns.
function parseDelimited(text: string, delimiter: ';' | ','): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let value = '';
  let state: 'start' | 'plain' | 'quoted' | 'closed' = 'start';
  const field = () => { row.push(value); value = ''; state = 'start'; };
  const record = () => { field(); if (row.some(cell => cell.trim())) records.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (state === 'quoted') {
      if (character === '"') {
        if (text[i + 1] === '"') { value += '"'; i++; }
        else state = 'closed';
      } else value += character;
      continue;
    }
    if (character === delimiter) { field(); continue; }
    if (character === '\n' || character === '\r') {
      if (character === '\r' && text[i + 1] === '\n') i++;
      record(); continue;
    }
    if (state === 'closed') {
      if (/\s/.test(character)) continue;
      throw new Error('Некорректный CSV: после закрывающей кавычки ожидается разделитель.');
    }
    if (character === '"') {
      if (state === 'plain' && value.trim()) throw new Error('Некорректный CSV: кавычка внутри поля должна быть экранирована двойной кавычкой.');
      value = ''; state = 'quoted';
    } else { value += character; if (character.trim()) state = 'plain'; }
  }
  if (state === 'quoted') throw new Error('Некорректный CSV: незакрытая двойная кавычка.');
  record();
  return records;
}
export function parseOrganizationCsv(raw: string): { delimiter: ';' | ','; rows: ImportRow[]; notices: string[] } {
  const text = raw.replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('CSV пуст. Добавьте заголовки и строки организаций.');
  const candidates = ([';', ','] as const).map(delimiter => {
    try {
      const records = parseDelimited(text, delimiter);
      const head = records[0] ?? [];
      const recognized = head.filter(value => headers.has(normalizeHeader(value))).length;
      const sample = records.slice(1, 21);
      const consistent = sample.filter(row => row.length === head.length).length;
      return { delimiter, records, score: recognized * 1000 + consistent + head.length / 100 };
    } catch (error) { return { delimiter, records: [], score: -1, error }; }
  }).sort((a, b) => b.score - a.score);
  const selected = candidates[0];
  if (selected.score < 0) throw selected.error;
  const [head, ...data] = selected.records;
  if (!head) throw new Error('CSV пуст.');
  const keys = head.map(value => headers.get(normalizeHeader(value)));
  const knownKeys = keys.filter((key): key is ImportField => !!key);
  if (new Set(knownKeys).size !== knownKeys.length) throw new Error('CSV содержит повторяющиеся колонки. Оставьте по одной колонке каждого поля.');
  const missing = required.filter(key => !keys.includes(key));
  if (missing.length) throw new Error(`Отсутствуют обязательные колонки: ${missing.map(key => importFields.find(field => field[0] === key)![1]).join(', ')}.`);
  if (!data.length) throw new Error('CSV содержит только заголовки. Добавьте хотя бы одну организацию.');
  const unknown = head.filter((_, index) => !keys[index]);
  const notices = unknown.length ? [`Нераспознанные колонки (${unknown.join(', ')}) будут пропущены.`] : [];
  const rows = data.map((cells, index): ImportRow => {
    const draft = Object.fromEntries(importFields.map(([key]) => [key, ''])) as OrganizationDraft;
    keys.forEach((key, column) => { if (key) draft[key] = (cells[column] ?? '').trim(); });
    return { number: index + 2, draft, structuralErrors: cells.length !== head.length
      ? ['Число полей не совпадает с заголовками. Проверьте значения в форме и сохраните строку.'] : [] };
  });
  return { delimiter: selected.delimiter, rows, notices };
}
export function csvTemplate() {
  const example: OrganizationDraft = {
    title: 'Пример организации', city: 'Енисейск', category: 'Кафе', address: '', phone: '', hours: '',
    website: '', vkUrl: '', description: '', lat: '', lon: '', sourceUrl: 'https://example.ru',
    sourceType: 'official_website', verifiedAt: '2026-10-10',
  };
  return '\uFEFF' + importFields.map(([, label]) => label).join(';') + '\r\n'
    + importFields.map(([key]) => example[key]).join(';') + '\r\n';
}
