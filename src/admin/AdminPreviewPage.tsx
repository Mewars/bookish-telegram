import { useState, type ChangeEvent, type SubmitEvent } from 'react';
import type { Item } from '../types';
import cityImage from '../assets/city.svg';
import { catalog } from '../data/catalog';
import { Icon } from '../components/Icon';
import { adminFields, newAdminDraft, type AdminDraft, type AdminStatus } from './model';
import { PREVIEW_STORAGE_KEY, previewRows, readPreviewEdits, type PreviewRow } from './previewStorage';
import './admin.css';

// Public browser-only trial: completely independent of backend data and write APIs.
// It is intentionally separate from AdminPage and its production permissions.
const demoImage = cityImage;
const supportedCities = ['Енисейск', 'Лесосибирск'] as const;
const originalRecords = () => catalog.filter(item => item.kind === 'places' || item.kind === 'services')
  .map(item => ({ item, status: 'published' as const }));
const initialEdits = () => {
  try { return readPreviewEdits(window.localStorage.getItem(PREVIEW_STORAGE_KEY)); }
  catch { return []; }
};
const toDraft = (item: Item, status: AdminStatus): AdminDraft => ({
  id: item.id, kind: item.kind === 'services' ? 'services' : 'places', city: item.city,
  title: item.title, category: item.category, description: item.description,
  address: item.address ?? '', phone: item.phone ?? '', hours: item.hours ?? '',
  website: item.website ?? '', vk_url: item.vkUrl ?? '', source_url: item.sourceUrl ?? '',
  image_url: '', status, verified_at: item.verifiedAt ?? '',
});

async function localPhotoThumbnail(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000 || !file.size) {
    throw new Error('Выберите JPG, PNG или WebP размером до 5 МБ.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const maxEdge = 900;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Браузер не может обработать эту фотографию.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const thumbnail = canvas.toDataURL('image/webp', .66);
    if (!thumbnail.startsWith('data:image/webp;base64,') || thumbnail.length > 580_000) {
      throw new Error('Фото слишком большое для пробного режима. Выберите снимок поменьше.');
    }
    return thumbnail;
  } finally { bitmap.close(); }
}

export function AdminPreviewPage({ goHome }: { goHome: () => void }) {
  const [baseline] = useState(originalRecords);
  const [edits, setEdits] = useState<PreviewRow[]>(initialEdits);
  const [draft, setDraft] = useState<AdminDraft | null>(null);
  const [city, setCity] = useState<string>('Енисейск');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('Все разделы');
  const [statusFilter, setStatusFilter] = useState('Все статусы');
  const [message, setMessage] = useState('');
  const rows = previewRows(baseline, edits);
  const filtered = rows.filter(({ item, status }) => item.city === city
    && (kindFilter === 'Все разделы' || item.kind === kindFilter)
    && (statusFilter === 'Все статусы' || status === statusFilter)
    && [item.title, item.address ?? '', item.category]
      .some(value => value.toLocaleLowerCase('ru').includes(filter.toLocaleLowerCase('ru'))));

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft?.title.trim() || !draft.category.trim() || !draft.description.trim()) {
      setMessage('Заполни название, категорию и описание.'); return;
    }
    if (photoBusy) return;
    const id = draft.id || `demo-${crypto.randomUUID()}`;
    const prior = rows.find(row => row.item.id === id);
    const item: Item = {
      ...(prior?.item ?? {}), id, kind: draft.kind, city: draft.city, real: true,
      title: draft.title.trim(), category: draft.category.trim(), description: draft.description.trim(),
      image: photoData ?? prior?.item.image ?? demoImage,
      address: draft.address.trim() || undefined, phone: draft.phone.trim() || undefined,
      hours: draft.hours.trim() || undefined, website: draft.website.trim() || undefined,
      vkUrl: draft.vk_url.trim() || undefined, sourceUrl: draft.source_url.trim() || undefined,
    };
    const change: PreviewRow = { item, status: draft.status };
    const updated = [...edits.filter(row => row.item.id !== id), change];
    if (updated.length > 60) { setMessage('В пробном кабинете можно сохранить не более 60 карточек.'); return; }
    try {
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      setMessage('Браузер запретил сохранение или закончилось место. Попробуйте уменьшить фотографию.');
      return;
    }
    setEdits(updated);
    setDraft(null);
    setPhotoData(null);
    setCity(draft.city);
    setMessage('Сохранено в пробном кабинете этого браузера. На настоящем сайте карточка НЕ опубликована.');
  };
  const edit = (row: PreviewRow) => {
    setMessage(''); setDraft(toDraft(row.item, row.status)); setPhotoData(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const create = () => {
    setMessage(''); setDraft(newAdminDraft(city)); setPhotoData(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const change = (key: keyof AdminDraft, value: string) =>
    setDraft(current => current ? { ...current, [key]: value } : null);
  const selectPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setPhotoBusy(true); setMessage('');
    try { setPhotoData(await localPhotoThumbnail(file)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось открыть фотографию.'); }
    finally { setPhotoBusy(false); event.target.value = ''; }
  };
  const clear = () => {
    if (!window.confirm('Очистить все пробные изменения, включая добавленные карточки и фотографии?')) return;
    try { window.localStorage.removeItem(PREVIEW_STORAGE_KEY); } catch { /* best effort */ }
    setEdits([]); setPhotoData(null); setDraft(null);
    setMessage('Пробные изменения очищены. Настоящий сайт не изменился.');
  };

  return <div className="admin-shell">
    <header className="admin-heading">
      <div><span className="eyebrow">РЯДОМ · ПРОБНАЯ АДМИНКА</span><h1>Попробуй добавить организацию</h1>
        <p>Места и услуги · {rows.filter(row => row.item.city === city).length} карточек в {city === 'Енисейск' ? 'Енисейске' : 'Лесосибирске'}</p></div>
      <button className="secondary-button" type="button" onClick={goHome}>На сайт <Icon name="arrow" size={17}/></button>
    </header>
    <p className="admin-demo-warning" role="status"><strong>Пробный кабинет, не публикация.</strong> Можно добавлять, редактировать и загружать свои фотографии. Всё сохраняется только на этом устройстве и в этом браузере. Другие жители карточки не увидят. В Supabase и реальном каталоге ничего не меняется.</p>
    {message && <p role="status" className="admin-message">{message}</p>}
    {draft ? <form className="admin-panel admin-form" onSubmit={submit}>
      <div className="admin-form-heading"><h2>{draft.id ? 'Редактирование карточки' : 'Новая карточка'}</h2>
        <button className="secondary-button" type="button" onClick={() => { setDraft(null); setPhotoData(null); }}>К списку</button></div>
      <div className="admin-form-grid">
        <label>Раздел<select value={draft.kind} disabled={Boolean(draft.id)} onChange={event => change('kind', event.target.value)}>
          <option value="places">Места</option><option value="services">Услуги</option></select></label>
        <label>Город<select value={draft.city} disabled={Boolean(draft.id)}
          onChange={event => change('city', event.target.value)}>
          {supportedCities.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
        {adminFields.map(field => <label key={field.key} className={field.key === 'description' ? 'admin-wide' : undefined}>
          {field.label}{'required' in field && field.required ? ' *' : ''}
          {['description','hours'].includes(field.key)
            ? <textarea rows={field.key === 'description' ? 4 : 2} maxLength={field.limit} value={draft[field.key]} onChange={event => change(field.key,event.target.value)}/>
            : <input type="text" maxLength={field.limit} value={draft[field.key]} onChange={event => change(field.key,event.target.value)}/>}
        </label>)}
        <label className="admin-wide admin-photo"><strong>Фотография (пробная загрузка)</strong>
          <small>Выбери настоящее фото JPG, PNG или WebP до 5 МБ. Снимок уменьшится и сохранится только в твоём браузере.</small>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void selectPhoto(event); }}/>
          {(photoData || rows.find(row => row.item.id === draft.id)?.item.image) &&
            <img src={photoData ?? rows.find(row => row.item.id === draft.id)?.item.image} alt="Предпросмотр фотографии организации"/>}
        </label>
        <label>Статус<select value={draft.status} onChange={event => change('status', event.target.value)}>
          <option value="draft">Черновик</option><option value="published">Опубликовано (только в пробном кабинете)</option>
          <option value="archived">Архив</option></select></label>
      </div>
      <button className="primary-button admin-save" type="submit" disabled={photoBusy}>
        {photoBusy ? 'Обработка фото…' : 'Сохранить в пробном кабинете'}</button>
    </form> : <section className="admin-panel">
      <div className="admin-toolbar"><h2>Организации: {city}</h2>
        <div className="admin-preview-actions">
          <button className="secondary-button" type="button" onClick={clear}>Очистить пробные изменения</button>
          <button className="primary-button" type="button" onClick={create}>+ Добавить организацию</button>
        </div>
      </div>
      <div className="admin-filters">
        <select aria-label="Выбрать город" value={city} onChange={event => setCity(event.target.value)}>
          {supportedCities.map(option => <option key={option} value={option}>{option}</option>)}</select>
        <input aria-label="Поиск организаций" type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Название или адрес"/>
        <select aria-label="Фильтр по разделу" value={kindFilter} onChange={event => setKindFilter(event.target.value)}>
          <option>Все разделы</option><option value="places">Места</option><option value="services">Услуги</option></select>
        <select aria-label="Фильтр по статусу" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
          <option>Все статусы</option><option value="published">Опубликовано</option><option value="draft">Черновики</option><option value="archived">Архив</option></select>
      </div>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Организация</th><th>Раздел</th><th>Статус</th><th>Действие</th></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.item.id}>
          <td><div className="admin-preview-organization">
            <img src={row.item.image || demoImage} alt="" loading="lazy"/>
            <div><strong>{row.item.title}</strong><small>{row.item.address ?? 'Адрес не указан'}</small></div>
          </div></td>
          <td>{row.item.kind === 'services' ? 'Услуги' : 'Места'}</td>
          <td><span className={`admin-status admin-status--${row.status}`}>
            {row.status === 'published' ? 'Опубликована в пробе' : row.status === 'draft' ? 'Черновик' : 'Архив'}
          </span></td>
          <td><button className="secondary-button" type="button" onClick={() => edit(row)}>Изменить</button></td>
        </tr>)}</tbody>
      </table></div>
      {!filtered.length && <p className="admin-empty">В этом городе пока нет карточек по выбранному фильтру. Нажми «Добавить организацию».</p>}
    </section>}
  </div>;
}
