import { useState, type SubmitEvent } from 'react';
import type { Item } from '../types';
import cityImage from '../assets/city.svg';
import { catalog } from '../data/catalog';
import { Icon } from '../components/Icon';
import { adminFields, newAdminDraft, type AdminDraft, type AdminStatus } from './model';
import '../admin/admin.css';

const demoImage = cityImage;
type PreviewRow = { item: Item; status: AdminStatus };
const initialRecords = () => catalog.filter(item => item.kind === 'places' || item.kind === 'services')
  .map(item => ({ item, status: 'published' as const }));
const toDraft = (item: Item, status: AdminStatus): AdminDraft => ({
  id: item.id, kind: item.kind === 'services' ? 'services' : 'places', city: item.city,
  title: item.title, category: item.category, description: item.description,
  address: item.address ?? '', phone: item.phone ?? '', hours: item.hours ?? '',
  website: item.website ?? '', vk_url: item.vkUrl ?? '', source_url: item.sourceUrl ?? '',
  image_url: '', status, verified_at: item.verifiedAt ?? '',
});

export function AdminPreviewPage({ goHome }: { goHome: () => void }) {
  const [rows, setRows] = useState<PreviewRow[]>(initialRecords);
  const [draft, setDraft] = useState<AdminDraft | null>(null);
  const [filter, setFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('Все разделы');
  const [statusFilter, setStatusFilter] = useState('Все статусы');
  const [message, setMessage] = useState('');

  const filtered = rows.filter(({ item, status }) => (kindFilter === 'Все разделы' || item.kind === kindFilter)
    && (statusFilter === 'Все статусы' || status === statusFilter)
    && [item.title, item.address ?? '', item.category].some(value => value.toLocaleLowerCase('ru').includes(filter.toLocaleLowerCase('ru'))));

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft?.title.trim() || !draft.category.trim() || !draft.description.trim()) {
      setMessage('Заполни название, категорию и описание.');
      return;
    }
    const id = draft.id || `demo-${crypto.randomUUID()}`;
    const prior = rows.find(row => row.item.id === id);
    const item: Item = {
      ...(prior?.item ?? {}), id, kind: draft.kind, city: draft.city, real: true,
      title: draft.title.trim(), category: draft.category.trim(), description: draft.description.trim(),
      image: prior?.item.image ?? demoImage,
      address: draft.address.trim() || undefined, phone: draft.phone.trim() || undefined,
      hours: draft.hours.trim() || undefined, website: draft.website.trim() || undefined,
      vkUrl: draft.vk_url.trim() || undefined, sourceUrl: draft.source_url.trim() || undefined,
    };
    setRows(current => [...current.filter(row => row.item.id !== id), { item, status: draft.status }]);
    setDraft(null);
    setMessage('Изменения сохранены только в демонстрации. После обновления страницы всё сбросится.');
  };
  const edit = (row: PreviewRow) => { setMessage(''); setDraft(toDraft(row.item, row.status)); window.scrollTo({top:0,behavior:'smooth'}); };
  const create = () => { setMessage(''); setDraft(newAdminDraft('Енисейск')); window.scrollTo({top:0,behavior:'smooth'}); };
  const change = (key: keyof AdminDraft, value: string) => setDraft(current => current ? {...current,[key]:value} : null);

  return <div className="admin-shell">
    <header className="admin-heading">
      <div><span className="eyebrow">РЯДОМ · ПРЕДПРОСМОТР</span><h1>Панель администратора</h1><p>Енисейск · {rows.length} организаций · только демонстрация</p></div>
      <button className="secondary-button" onClick={goHome}>На сайт <Icon name="arrow" size={17}/></button>
    </header>
    <p className="admin-demo-warning" role="status"><strong>Демонстрационный режим.</strong> Никакие данные в Supabase не изменяются, фотографии не загружаются и новые карточки на настоящем сайте не публикуются. Для реального управления нужна резервная копия и права администратора.</p>
    {message && <p role="status" className="admin-message">{message}</p>}
    {draft ? <form className="admin-panel admin-form" onSubmit={submit}>
      <div className="admin-form-heading"><h2>{draft.id ? 'Редактирование карточки' : 'Новая карточка'}</h2><button className="secondary-button" type="button" onClick={() => setDraft(null)}>К списку</button></div>
      <div className="admin-form-grid">
        <label>Раздел<select value={draft.kind} disabled={Boolean(draft.id)} onChange={event => change('kind', event.target.value)}><option value="places">Места</option><option value="services">Услуги</option></select></label>
        <label>Город<select value={draft.city} disabled><option value="Енисейск">Енисейск</option></select></label>
        {adminFields.map(field => <label key={field.key} className={field.key === 'description' ? 'admin-wide' : undefined}>
          {field.label}{'required' in field && field.required ? ' *' : ''}
          {['description','hours'].includes(field.key)
            ? <textarea rows={field.key === 'description' ? 4 : 2} maxLength={field.limit} value={draft[field.key]} onChange={event => change(field.key,event.target.value)}/>
            : <input type="text" maxLength={field.limit} value={draft[field.key]} onChange={event => change(field.key,event.target.value)}/>}
        </label>)}
        <div className="admin-wide admin-photo"><strong>Фотография</strong><small>В реальном кабинете здесь можно загрузить JPEG, PNG или WebP. В демо загрузка отключена.</small></div>
        <label>Статус<select value={draft.status} onChange={event => change('status',event.target.value)}><option value="published">Опубликовано (только в демо)</option><option value="draft">Черновик</option><option value="archived">Архив</option></select></label>
      </div>
      <button className="primary-button admin-save" type="submit">Сохранить в демо</button>
    </form> : <section className="admin-panel">
      <div className="admin-toolbar"><h2>Организации Енисейска</h2><button className="primary-button" onClick={create}>+ Добавить (демо)</button></div>
      <div className="admin-filters">
        <input aria-label="Поиск организаций" type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Название или адрес"/>
        <select aria-label="Фильтр по разделу" value={kindFilter} onChange={event => setKindFilter(event.target.value)}><option>Все разделы</option><option value="places">Места</option><option value="services">Услуги</option></select>
        <select aria-label="Фильтр по статусу" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>Все статусы</option><option value="published">Опубликовано</option><option value="draft">Черновики</option><option value="archived">Архив</option></select>
      </div>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Организация</th><th>Раздел</th><th>Статус</th><th>Действие</th></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.item.id}><td><strong>{row.item.title}</strong><small>{row.item.address}</small></td><td>{row.item.kind === 'services' ? 'Услуги' : 'Места'}</td><td><span className={`admin-status admin-status--${row.status}`}>{row.status === 'published' ? 'Опубликована' : row.status === 'draft' ? 'Черновик' : 'Архив'}</span></td><td><button className="secondary-button" onClick={() => edit(row)}>Изменить</button></td></tr>)}</tbody>
      </table></div>
      {!filtered.length && <p className="admin-empty">По выбранным условиям ничего не найдено.</p>}
    </section>}
  </div>;
}
