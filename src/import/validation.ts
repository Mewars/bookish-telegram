import { importFields, sourceTypes, type CheckedRow, type ImportRow, type OrganizationDraft, type OrganizationImportRecord, type OrganizationSourceType } from './types';
const required = { title: 'Не указано название', city: 'Не указан город', category: 'Не указана категория', sourceUrl: 'Не указан источник', sourceType: 'Не указан тип источника' };
const normalize = (text: string) => text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function trimDraft(draft: OrganizationDraft): OrganizationDraft {
  return Object.fromEntries(importFields.map(([key]) => [key, draft[key].trim()])) as OrganizationDraft;
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validNumber(value: string, limit: number) {
  return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;
}
export function validateRows(rows: ImportRow[]): CheckedRow[] {
  // Group in linear time. Report one matching row per record, avoiding quadratic
  // warning lists even when the entire 5 MB file repeats the same organization.
  const groups = new Map<string, { all: number[]; empty: number[]; addresses: Map<string, number[]> }>();
  for (const row of rows) {
    const draft = trimDraft(row.draft);
    if (!draft.title || !draft.city) continue;
    const key = JSON.stringify([normalize(draft.title), normalize(draft.city)]);
    const group = groups.get(key) ?? { all: [], empty: [], addresses: new Map<string, number[]>() };
    group.all.push(row.number);
    const address = normalize(draft.address);
    if (!address) group.empty.push(row.number);
    else { const matches = group.addresses.get(address) ?? []; matches.push(row.number); group.addresses.set(address, matches); }
    groups.set(key, group);
  }
  return rows.map(row => {
    const draft = trimDraft(row.draft);
    const errors = [...row.structuralErrors];
    const warnings: string[] = [];
    for (const [key, message] of Object.entries(required)) if (!draft[key as keyof typeof required]) errors.push(message);
    if (draft.sourceType && !Object.hasOwn(sourceTypes, draft.sourceType)) errors.push('Неизвестный тип источника');
    for (const [key, label] of [['website', 'Сайт'], ['vkUrl', 'VK'], ['sourceUrl', 'Источник']] as const) {
      const value = draft[key];
      if (!value) continue;
      try {
        if (!/^https?:\/\//i.test(value) || /\s/.test(value)) throw new Error();
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
        if (key === 'vkUrl' && !['vk.com', 'vk.ru'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
          errors.push('VK: допустимы только домены vk.com / vk.ru и их поддомены');
        }
        if (url.protocol === 'http:') warnings.push(`${label}: используется HTTP. Для публикации предпочтителен HTTPS.`);
      } catch { errors.push(`${label}: некорректный URL (нужен http:// или https://)`); }
    }
    if (draft.lat && !draft.lon) errors.push('Указана широта без долготы');
    if (draft.lon && !draft.lat) errors.push('Указана долгота без широты');
    if (draft.lat && !validNumber(draft.lat, 90)) errors.push('Неверная широта: требуется число от −90 до 90');
    if (draft.lon && !validNumber(draft.lon, 180)) errors.push('Неверная долгота: требуется число от −180 до 180');
    if (!draft.verifiedAt) warnings.push('Не указана дата проверки');
    else if (!validDate(draft.verifiedAt)) errors.push('Неверная дата проверки: требуется существующая дата YYYY-MM-DD');
    const group = groups.get(JSON.stringify([normalize(draft.title), normalize(draft.city)]));
    const address = normalize(draft.address);
    const matches = !address ? group?.all : group?.addresses.get(address);
    const other = matches?.[0] === row.number ? matches[1] : matches?.[0];
    const emptyOther = group?.empty[0] === row.number ? group.empty[1] : group?.empty[0];
    const duplicateNumber = other ?? emptyOther;
    const duplicate = duplicateNumber !== undefined;
    if (duplicate) warnings.push(`Возможный дубль строки №${duplicateNumber}`);
    return { ...row, draft, errors, warnings, duplicate, status: errors.length ? 'error' : warnings.length ? 'warning' : 'ready' };
  });
}
export function exportRecords(rows: ImportRow[]): OrganizationImportRecord[] {
  return validateRows(rows).filter(row => !row.errors.length).map(({ draft }) => {
    const record: OrganizationImportRecord = { title: draft.title, city: draft.city, category: draft.category,
      sourceUrl: draft.sourceUrl, sourceType: draft.sourceType as OrganizationSourceType };
    for (const key of ['address', 'phone', 'hours', 'website', 'vkUrl', 'description', 'verifiedAt'] as const) {
      if (draft[key]) record[key] = draft[key];
    }
    if (draft.lat && draft.lon) record.coordinates = { lat: Number(draft.lat), lon: Number(draft.lon) };
    return record;
  });
}
