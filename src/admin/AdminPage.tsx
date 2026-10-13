import { useEffect, useState, type SubmitEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { availableCities } from '../data/cities';
import type { OrganizationRow } from '../organizations/model';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import {
  adminFields, canManageCity, newAdminDraft, rowToAdminDraft,
  validateAdminDraft, type AdminDraft, type CityAdminAccess, type AdminStatus,
} from './model';
import { readAdminOrganizations, readCityAccess, saveAdminOrganization, uploadAdminPhoto } from './repository';
import './admin.css';

export function AdminPage({ enabled, goHome, openLogin }: { enabled: boolean; goHome: () => void; openLogin: () => void }) {
  const { state } = useAuth();
  const userId = state.user?.id;
  const [access, setAccess] = useState<CityAdminAccess[] | null>(null);
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [loadingError, setLoadingError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<AdminDraft | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('Все города');

  useEffect(() => {
    if (!enabled || !userId || !supabase) return;
    let active = true;
    Promise.resolve().then(async () => {
      const permissions = await readCityAccess(supabase, userId);
      if (!permissions.length) throw new Error('У этого аккаунта нет доступа к административной панели.');
      const organizations = await readAdminOrganizations(supabase, userId, permissions);
      if (active) { setAccess(permissions); setRows(organizations); setLoadingError(''); }
    }).catch(error => {
      if (active) setLoadingError(error instanceof Error ? error.message : 'Нет доступа к админке.');
    });
    return () => { active = false; };
  }, [enabled, userId, attempt]);

  const edit = (row: OrganizationRow) => {
    setDraft(rowToAdminDraft(row)); setSelectedFile(null); setConfirmed(false); setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const create = () => {
    const city = access?.find(entry => entry.city !== '*')?.city ?? availableCities[0].name;
    setDraft(newAdminDraft(city)); setSelectedFile(null); setConfirmed(false); setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const change = (key: keyof AdminDraft, value: string) => {
    setDraft(current => current ? { ...current, [key]: value } : current);
  };

  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !draft || !userId || !supabase || !access) return;
    const errors = validateAdminDraft(draft, confirmed);
    if (Object.keys(errors).length) { setMessage(Object.values(errors)[0]); return; }
    setBusy(true); setMessage('');
    try {
      let values = draft;
      if (selectedFile) {
        const imageUrl = await uploadAdminPhoto(supabase, userId, access, draft.city, selectedFile);
        values = { ...draft, image_url: imageUrl };
      }
      const saved = await saveAdminOrganization(supabase, userId, access, values, confirmed);
      setRows(current => [...current.filter(row => row.id !== saved.id), saved].sort((a,b) => a.title.localeCompare(b.title, 'ru')));
      setDraft(rowToAdminDraft(saved)); setSelectedFile(null); setConfirmed(false);
      setMessage(saved.status === 'published' ? 'Карточка опубликована. Посетители увидят её при следующей загрузке каталога.' : 'Изменения сохранены.');
      window.dispatchEvent(new Event('ryadom:organizations-changed'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить карточку.');
    } finally { setBusy(false); }
  };

  if (!enabled) return <EmptyState title="Админка готовится к запуску" text="Пока мы не проверили права в Supabase и не включили защищённый доступ, управление организациями выключено." action="На главную" onAction={goHome}/>;
  if (state.status === 'loading') return <p role="status">Проверяем вход администратора…</p>;
  if (!userId) return <EmptyState title="Для входа в админку нужна авторизация" text="Войди под своей учётной записью «Рядом». Доступ к управлению выдаётся отдельно." action="Войти" onAction={openLogin}/>;
  if (loadingError) return <div className="admin-shell"><h1>Доступ к админке</h1><p role="alert">{loadingError}</p><button className="secondary-button" onClick={() => { setAccess(null); setLoadingError(''); setAttempt(value => value + 1); }}>Повторить проверку</button></div>;
  if (!access) return <p role="status">Проверяем права на управление городами…</p>;

  const owner = access.some(entry => entry.city === '*' && entry.role === 'owner');
  const cities = [...new Set([...rows.map(row => row.city), ...access.filter(entry => entry.city !== '*').map(entry => entry.city), ...(owner ? availableCities.map(row => row.name) : [])])].sort((a,b) => a.localeCompare(b, 'ru'));
  const filtered = rows.filter(row => (cityFilter === 'Все города' || row.city === cityFilter)
    && [row.title, row.category, row.address ?? ''].some(value => value.toLocaleLowerCase('ru').includes(filter.trim().toLocaleLowerCase('ru'))));
  const published = rows.filter(row => row.status === 'published').length;

  return <div className="admin-shell">
    <header className="admin-heading">
      <div><span className="eyebrow">РЯДОМ · УПРАВЛЕНИЕ</span><h1>Организации</h1><p>{owner ? 'Главный администратор' : 'Редактор города'} · {rows.length} карточек · {published} опубликовано</p></div>
      <button className="secondary-button" onClick={goHome}>На сайт <Icon name="arrow" size={17}/></button>
    </header>

    {draft ? <form className="admin-panel admin-form" onSubmit={save} noValidate aria-busy={busy}>
      <div className="admin-form-heading"><h2>{draft.id ? 'Редактировать организацию' : 'Новая организация'}</h2><button type="button" className="secondary-button" disabled={busy} onClick={() => { setDraft(null); setMessage(''); }}>К списку</button></div>
      <p>Не публикуй вымышленные организации или чужие фотографии без разрешения. Для публикации проверь информацию и подтверди это ниже.</p>
      <div className="admin-form-grid">
        <label>Город
          <select disabled={busy || !!draft.id} value={draft.city} onChange={event => change('city', event.target.value)}>
            {[...new Set([...cities, draft.city])].filter(city => canManageCity(access, city)).map(city => <option value={city} key={city}>{city}</option>)}
          </select>
        </label>
        {adminFields.map(field => <label key={field.key} className={field.key === 'description' ? 'admin-wide' : undefined}>
          {field.label}{field.required ? ' *' : ''}
          {['description', 'hours'].includes(field.key)
            ? <textarea rows={field.key === 'description' ? 5 : 3} disabled={busy} maxLength={field.limit} value={draft[field.key]} onChange={event => change(field.key, event.target.value)}/>
            : <input disabled={busy} maxLength={field.limit} type={field.key === 'phone' ? 'tel' : ['website','vk_url','source_url'].includes(field.key) ? 'url' : 'text'} value={draft[field.key]} onChange={event => change(field.key, event.target.value)} placeholder={['website','vk_url','source_url'].includes(field.key) ? 'https://' : undefined}/>}
        </label>)}
        <div className="admin-wide admin-photo">
          <strong>Фотография организации</strong>
          {draft.image_url && <img src={draft.image_url} alt="Текущая фотография" loading="lazy"/>}
          <input aria-label="Фотография организации" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => setSelectedFile(event.target.files?.[0] ?? null)}/>
          <small>JPEG, PNG или WebP до 2 МБ. Загружай только фотографии, разрешённые для публикации.</small>
        </div>
        <label>Статус
          <select value={draft.status} disabled={busy} onChange={event => { change('status', event.target.value as AdminStatus); setConfirmed(false); }}>
            <option value="draft">Черновик (не показывать)</option>
            <option value="published">Опубликовано</option>
            <option value="archived">Архив (скрыто)</option>
          </select>
        </label>
        {draft.status === 'published' && <label className="admin-wide admin-confirm">
          <input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)}/>
          <span>Я проверил актуальность сведений и имею право публиковать приложенные фотографии.</span>
        </label>}
      </div>
      {message && <p role="status" className="admin-message">{message}</p>}
      <button className="primary-button admin-save" disabled={busy} type="submit">{busy ? 'Сохраняем…' : draft.status === 'published' ? 'Проверить и опубликовать' : 'Сохранить карточку'}</button>
    </form> : <section className="admin-panel">
      <div className="admin-toolbar"><h2>Каталог организаций</h2><button className="primary-button" onClick={create}>+ Добавить организацию</button></div>
      <div className="admin-filters">
        <input type="search" aria-label="Поиск организаций" placeholder="Поиск по названию, категории, адресу" value={filter} onChange={event => setFilter(event.target.value)}/>
        {cities.length > 1 && <select aria-label="Фильтр по городу" value={cityFilter} onChange={event => setCityFilter(event.target.value)}><option>Все города</option>{cities.map(city => <option key={city}>{city}</option>)}</select>}
      </div>
      {filtered.length ? <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Организация</th><th>Город</th><th>Статус</th><th>Управление</th></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id}>
          <td><strong>{row.title}</strong><small>{row.category}</small></td>
          <td>{row.city}</td>
          <td><span className={`admin-status admin-status--${row.status}`}>{row.status === 'published' ? 'Опубликована' : row.status === 'draft' ? 'Черновик' : 'В архиве'}</span></td>
          <td><button type="button" className="secondary-button" onClick={() => edit(row)}>Изменить</button></td>
        </tr>)}</tbody>
      </table></div> : <p className="admin-empty">Карточек пока нет. Нажми «Добавить организацию», чтобы создать первую запись.</p>}
    </section>}
  </div>;
}
