import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { availableCities, type DirectoryCity } from '../data/cities';
import { CityManagement } from './CityManagement';
import type { OrganizationRow } from '../organizations/model';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { BrandWordmark } from '../components/BrandWordmark';
import { VkFederalComposer } from './VkFederalComposer';
import {
  canManageCity, manageableAdminCities, newAdminDraft, rowToAdminDraft,
  validateAdminDraft, type AdminDraft, type CityAdminAccess, type AdminStatus,
} from './model';
import { readAdminOrganizations, readCityAccess, saveAdminOrganization, uploadAdminPhoto, removeOrphanedAdminPhoto, changeAdminOrganizationAvailability } from './repository';
import { directoryCategories, categoryForOrganization, type DirectoryCategoryId } from './directoryCategories';
import './admin.css';

export function AdminPage({ enabled, cityDirectoryEnabled, cities: directoryCities, refreshCities, goHome, openLogin }: { enabled: boolean; cityDirectoryEnabled: boolean; cities: readonly DirectoryCity[]; refreshCities: () => void; goHome: () => void; openLogin: () => void }) {
  const { state } = useAuth();
  const userId = state.user?.id;
  const [access, setAccess] = useState<CityAdminAccess[] | null>(null);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
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
  const [kindFilter, setKindFilter] = useState('Все разделы');
  const [statusFilter, setStatusFilter] = useState('Действующие');
  const [categoryFilter, setCategoryFilter] = useState<DirectoryCategoryId | 'all'>('all');
  const [screen, setScreen] = useState<'overview' | 'catalog' | 'photos' | 'cities'>('overview');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const chooseFile = (next: File | null) => {
    setSelectedFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : '');
    if (!next && fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    const client = supabase;
    if (!enabled || !userId || !client) return;
    let active = true;
    Promise.resolve().then(async () => {
      const permissions = await readCityAccess(client, userId);
      if (!permissions.length) throw new Error('У этого аккаунта нет доступа к административной панели.');
      const organizations = await readAdminOrganizations(client, userId, permissions);
      if (active) { setAccess(permissions); setCheckedUserId(userId); setRows(organizations); setLoadingError(''); }
    }).catch(error => {
      if (active) { setCheckedUserId(userId); setAccess(null); setRows([]); setLoadingError(error instanceof Error ? error.message : 'Нет доступа к админке.'); }
    });
    return () => { active = false; };
  }, [enabled, userId, attempt]);

  const edit = (row: OrganizationRow) => {
    setDraft(rowToAdminDraft(row)); chooseFile(null); setConfirmed(false); setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const create = (groupId?: DirectoryCategoryId) => {
    const preferred = cityFilter !== 'Все города' && access && canManageCity(access, cityFilter) ? cityFilter : null;
    const city = preferred ?? access?.find(entry => entry.active && entry.city !== '*')?.city ?? directoryCities[0]?.name ?? availableCities[0].name;
    const group = directoryCategories.find(entry => entry.id === groupId) ?? directoryCategories[0];
    setDraft({ ...newAdminDraft(city), category: group.value, kind: group.kind });
    chooseFile(null); setConfirmed(false); setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const chooseCategory = (id: DirectoryCategoryId) => {
    setCategoryFilter(id);
    setScreen('catalog');
    setStatusFilter('Действующие');
    setFilter('');
  };
  const navigateAdmin = (next: 'overview' | 'catalog' | 'photos' | 'cities') => {
    setDraft(null); setMessage(''); setScreen(next);
    setCategoryFilter('all'); setFilter(''); setStatusFilter('Действующие');
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
    let uploadedPath: string | null = null;
    try {
      let values = draft;
      if (selectedFile) {
        const photo = await uploadAdminPhoto(supabase, userId, access, draft.city, selectedFile);
        uploadedPath = photo.path;
        values = { ...draft, image_url: photo.url };
      }
      const saved = await saveAdminOrganization(supabase, userId, access, values, confirmed);
      setRows(current => [...current.filter(row => row.id !== saved.id), saved].sort((a,b) => a.title.localeCompare(b.title, 'ru')));
      setDraft(rowToAdminDraft(saved)); chooseFile(null); setConfirmed(false);
      setMessage(saved.status === 'published' ? 'Карточка опубликована. Посетители увидят её при следующей загрузке каталога.' : 'Изменения сохранены.');
      window.dispatchEvent(new Event('ryadom:organizations-changed'));
    } catch (error) {
      if (uploadedPath && supabase) {
        try { await removeOrphanedAdminPhoto(supabase, uploadedPath); } catch { /* Best-effort cleanup, preserve original error. */ }
      }
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить карточку.');
    } finally { setBusy(false); }
  };


  const toggleAvailability = async (row: OrganizationRow) => {
    if (busy || !userId || !supabase || !access) return;
    const restoring = row.status === 'archived';
    if (!restoring && !window.confirm(
      `Убрать организацию «${row.title}» (${row.city}) с сайта?\n\nКарточка перейдёт в архив, но её данные и фото сохранятся. Позже её можно будет восстановить.`
    )) return;
    if (restoring && !window.confirm(
      `Вернуть организацию «${row.title}» в черновики?\nОна не появится на сайте до повторной проверки и публикации.`
    )) return;
    setBusy(true); setMessage('');
    try {
      const updated = await changeAdminOrganizationAvailability(supabase, userId, access, row);
      setRows(current => current.map(item => item.id === updated.id ? updated : item));
      setMessage(restoring
        ? `«${updated.title}» восстановлена в черновики. Для публикации проверь информацию.`
        : `«${updated.title}» убрана с сайта и перенесена в архив. Восстановление — через фильтр «Архив».`);
      window.dispatchEvent(new Event('ryadom:organizations-changed'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось изменить статус организации.');
    } finally { setBusy(false); }
  };

  if (!enabled) return <EmptyState title="Админка готовится к запуску" text="Пока мы не проверили права в Supabase и не включили защищённый доступ, управление организациями выключено." action="На главную" onAction={goHome}/>;
  if (state.status === 'loading') return <p role="status">Проверяем вход администратора…</p>;
  if (!userId) return <EmptyState title="Для входа в админку нужна авторизация" text="Войди под своей учётной записью «Рядом». Доступ к управлению выдаётся отдельно." action="Войти" onAction={openLogin}/>;
  if (checkedUserId !== userId) return <p role="status">Проверяем права этого аккаунта…</p>;
  if (loadingError) return <div className="admin-shell"><h1>Доступ к админке</h1><p role="alert">{loadingError}</p><button className="secondary-button" onClick={() => { setAccess(null); setLoadingError(''); setAttempt(value => value + 1); }}>Повторить проверку</button></div>;
  if (!access) return <p role="status">Проверяем права на управление городами…</p>;

  const owner = access.some(entry => entry.city === '*' && entry.role === 'owner');
  const cities = manageableAdminCities(
    access, rows.map(row => row.city),
    owner ? directoryCities.map(city => city.name) : [],
  );
  const cityRows = rows.filter(row => cityFilter === 'Все города' || row.city === cityFilter);
  const activeRows = cityRows.filter(row => row.status !== 'archived');
  const filtered = cityRows.filter(row =>
    (categoryFilter === 'all' || categoryForOrganization(row) === categoryFilter)
    && (kindFilter === 'Все разделы' || (row.kind === 'services' ? 'services' : 'places') === kindFilter)
    && (statusFilter === 'Все статусы' || (statusFilter === 'Действующие' ? row.status !== 'archived' : row.status === statusFilter))
    && (screen !== 'photos' || Boolean(row.image_url))
    && [row.title, row.category, row.address ?? ''].some(value => value.toLocaleLowerCase('ru').includes(filter.trim().toLocaleLowerCase('ru')))
  ).sort((left, right) => left.title.localeCompare(right.title, 'ru'));
  const published = cityRows.filter(row => row.status === 'published').length;
  const draftCount = cityRows.filter(row => row.status === 'draft').length;
  const selectedLabel = categoryFilter === 'all' ? 'Все организации' :
    directoryCategories.find(category => category.id === categoryFilter)?.label ?? 'Все организации';
  const categories = <div className="admin-cms-tiles">
    {directoryCategories.map(category => {
      const count = activeRows.filter(row => categoryForOrganization(row) === category.id).length;
      return <button key={category.id} type="button"
        className={'admin-cms-tile' + (categoryFilter === category.id && screen === 'catalog' ? ' is-selected' : '')}
        aria-label={category.label + ': ' + count} aria-pressed={categoryFilter === category.id && screen === 'catalog'}
        onClick={() => chooseCategory(category.id)}>
        <span className="admin-cms-bubble" style={{ backgroundColor: category.color }}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d={category.path}/>
          </svg>
        </span>
        <strong>{category.label}</strong><small>{count} объект(ов)</small>
      </button>;
    })}
  </div>;
  const organizationCards = <div className="admin-cms-cards">
    {filtered.map(row => {
      const group = directoryCategories.find(category => category.id === categoryForOrganization(row));
      return <div className="admin-cms-card" key={row.id}>
        <button type="button" className="admin-cms-card-open" onClick={() => edit(row)}
          disabled={busy} aria-label={`Редактировать: ${row.title}`}>
          <span className="admin-cms-card-icon" aria-hidden="true">
            {row.image_url ? <img src={row.image_url} alt="" loading="lazy"/> :
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={group?.path ?? 'M12 2v20M2 12h20'}/>
              </svg>}
          </span>
          <span className="admin-cms-card-main">
            <strong>{row.title}</strong>
            <small>{row.address || 'Адрес не указан'} · {row.category} · {row.city}</small>
            <em className={'admin-cms-status admin-cms-status--' + row.status}>
              {row.status === 'published' ? '● Опубликовано' : row.status === 'draft' ? '● Черновик' : '● Архив'}
            </em>
          </span>
          <span aria-hidden="true" className="admin-cms-card-arrow">›</span>
        </button>
        <button type="button" className="admin-cms-card-action"
          disabled={busy}
          aria-label={row.status === 'archived' ? `Восстановить в черновики: ${row.title}` : `Убрать в архив: ${row.title}`}
          title={row.status === 'archived' ? 'Восстановить в черновики' : 'Убрать с сайта в архив'}
          onClick={() => { void toggleAvailability(row); }}>
          {row.status === 'archived' ?
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11a9 9 0 1 1 2.3 6M3 4v7h7"/></svg> :
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6"/></svg>}
        </button>
      </div>;
    })}
  </div>;

  return <div className="admin-cms-layout">
    <aside className="admin-cms-sidebar" aria-label="Управление каталогом">
      <button type="button" className="admin-cms-wordmark" aria-label="Рядом — к обзору админки" onClick={() => { navigateAdmin('overview'); window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }}><BrandWordmark decorative/></button>
      <p className="admin-cms-sidebar-caption">Панель управления</p>
      <p className="admin-cms-nav-label">РАЗДЕЛЫ</p>
      <nav className="admin-cms-nav" aria-label="Разделы админки">
        <button type="button" className={screen === 'overview' && !draft ? 'active' : ''} onClick={() => navigateAdmin('overview')}>▦ <span>Обзор города</span></button>
        <button type="button" className={screen === 'catalog' && !draft ? 'active' : ''} onClick={() => navigateAdmin('catalog')}>▤ <span>Организации</span></button>
        <button type="button" className={screen === 'photos' && !draft ? 'active' : ''} onClick={() => navigateAdmin('photos')}>▧ <span>Фотографии</span></button>
        {owner && <button type="button" className={screen === 'cities' && !draft ? 'active' : ''} onClick={() => navigateAdmin('cities')}>⌖ <span>Города</span></button>}
        <button type="button" className={draft ? 'active' : ''} onClick={() => create()}>＋ <span>Добавить организацию</span></button>
      </nav>
      <div className="admin-cms-sidebar-note">
        <strong>{owner ? 'Владелец платформы' : 'Администратор города'}</strong>
        <span>{owner ? 'Доступ к управлению всеми подключёнными городами.' : 'Доступ только к назначенным городам.'}</span>
      </div>
    </aside>
    <div className="admin-cms-main">
      <div className="admin-cms-topbar">
        <span>Рядом / {draft ? 'Редактор организации' : screen === 'overview' ? 'Обзор города' : screen === 'photos' ? 'Фотографии' : screen === 'cities' ? 'Города' : 'Организации'}</span>
        <div className="admin-cms-top-actions">
          {cities.length > 1 && <select aria-label="Город управления" value={cityFilter} onChange={event => { setCityFilter(event.target.value); setCategoryFilter('all'); }}>
            <option>Все города</option>{cities.map(city => <option key={city}>{city}</option>)}
          </select>}
          <button type="button" className="secondary-button" onClick={goHome}>На сайт <Icon name="arrow" size={17}/></button>
        </div>
      </div>
      <div className="admin-shell admin-cms-content">
        <header className="admin-cms-header">
          <div><span className="eyebrow">РЯДОМ · УПРАВЛЕНИЕ ГОРОДОМ</span>
            <h1>{draft ? draft.id ? 'Редактирование организации' : 'Новая организация' : screen === 'overview' ? 'Управление каталогом' : screen === 'photos' ? 'Фотографии организаций' : screen === 'cities' ? 'Управление городами' : selectedLabel}</h1>
            <p>{owner ? 'Главный администратор' : 'Редактор города'} · {cityFilter === 'Все города' ? 'Все доступные города' : cityFilter} · {activeRows.length} карточек</p>
          </div>
          {!draft && <button className="primary-button" onClick={() => create()}>＋ Добавить организацию</button>}
        </header>

        {draft ? <form className="admin-cms-form" onSubmit={save} noValidate aria-busy={busy}>
          <button type="button" className="admin-cms-back" disabled={busy} onClick={() => { setDraft(null); chooseFile(null); setMessage(''); }}>← К списку организаций</button>
          <section className="admin-panel admin-cms-form-section">
            <h2>Основная информация</h2>
            <p>Название, категория и описание будут показаны посетителям городского каталога.</p>
            <div className="admin-form-grid">
              <label className="admin-wide">Название организации *
                <input required disabled={busy} maxLength={160} value={draft.title} placeholder="Например, кафе «Уют»" onChange={event => change('title',event.target.value)}/>
              </label>
              <label>Город
                <select disabled={busy || !!draft.id} value={draft.city} onChange={event => change('city',event.target.value)}>
                  {[...new Set([...cities,draft.city])].filter(city => canManageCity(access,city)).map(city => <option key={city}>{city}</option>)}
                </select>
              </label>
              <label>Категория каталога *
                <select disabled={busy} value={categoryForOrganization(draft)} onChange={event => {
                  const group = directoryCategories.find(category => category.id === event.target.value);
                  if (group) setDraft(current => current ? { ...current, category: group.value, kind: current.id ? current.kind : group.kind } : current);
                }}>
                  {directoryCategories.filter(group => !draft.id || group.kind === draft.kind).map(group =>
                    <option value={group.id} key={group.id}>{group.label}</option>)}
                </select>
              </label>
              <label>Раздел каталога
                <select disabled={busy || !!draft.id} value={draft.kind} onChange={event => change('kind',event.target.value)}>
                  <option value="places">Места и организации</option><option value="services">Услуги</option>
                </select>
              </label>
              <label className="admin-wide">Уточнение категории
                <input disabled={busy} maxLength={100} value={draft.category} onChange={event => change('category',event.target.value)} placeholder="Например, кафе, пиццерия, музей"/>
              </label>
              <label className="admin-wide">Описание *
                <textarea disabled={busy} rows={5} maxLength={2000} value={draft.description} onChange={event => change('description',event.target.value)} placeholder="Расскажи, что здесь находится и чем полезно посетителям"/>
              </label>
            </div>
          </section>
          <section className="admin-panel admin-cms-form-section">
            <h2>Контакты и время работы</h2><p>Эту информацию можно будет обновлять в любой момент.</p>
            <div className="admin-form-grid">
              <label className="admin-wide">Адрес
                <input disabled={busy} maxLength={300} value={draft.address} onChange={event => change('address',event.target.value)}/>
              </label>
              <fieldset className="admin-wide admin-location-fields">
                <legend>Точное место на карте (необязательно)</legend>
                <p>Чтобы показать отметку точно на здании, укажи координаты из OpenStreetMap или собственных проверенных данных. Без них будет доступна ссылка на поиск адреса — без выдуманной отметки.</p>
                <div className="admin-location-grid">
                  <label>Широта
                    <input disabled={busy} type="text" inputMode="decimal" maxLength={30} value={draft.latitude}
                      placeholder="Например, 58.45" onChange={event => change('latitude',event.target.value)}/>
                  </label>
                  <label>Долгота
                    <input disabled={busy} type="text" inputMode="decimal" maxLength={30} value={draft.longitude}
                      placeholder="Например, 92.17" onChange={event => change('longitude',event.target.value)}/>
                  </label>
                </div>
              </fieldset>
              <label>Телефон
                <input disabled={busy} type="tel" maxLength={40} value={draft.phone} onChange={event => change('phone',event.target.value)}/>
              </label>
              <label>Время работы
                <textarea disabled={busy} rows={2} maxLength={300} value={draft.hours} onChange={event => change('hours',event.target.value)} placeholder="Пн–Вс, 10:00–21:00"/>
              </label>
              {(['website','vk_url','source_url'] as const).map(key => <label key={key} className={key === 'source_url' ? 'admin-wide' : undefined}>
                {key === 'website' ? 'Сайт организации' : key === 'vk_url' ? 'Страница ВКонтакте' : 'Источник сведений'}
                <input disabled={busy} type="url" maxLength={500} value={draft[key]} onChange={event => change(key,event.target.value)} placeholder="https://"/>
              </label>)}
            </div>
          </section>
          <section className="admin-panel admin-cms-form-section">
            <h2>Фотография организации</h2>
            <p>Только настоящие фотографии, на публикацию которых есть разрешение. Изображение можно посмотреть до сохранения.</p>
            <div className="admin-cms-photo-picker">
              <div className="admin-cms-photo-preview">
                {(previewUrl || draft.image_url) ? <img src={previewUrl || draft.image_url} alt="Предпросмотр фотографии организации"/> :
                  <span>Фотография не загружена</span>}
              </div>
              <div className="admin-cms-photo-controls">
                <strong>Главная фотография</strong>
                <input ref={fileInputRef} aria-label="Выбрать фотографию" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" disabled={busy} onChange={event => chooseFile(event.target.files?.[0] ?? null)}/>
                {selectedFile && <small>Выбран файл: {selectedFile.name}</small>}
                <small>Автоматически: обрезка по центру до 16:9, уменьшение до 1440×810, сжатие до 2 МБ, удаление геометок. WebP или JPG, если WebP не поддерживается.</small>
                {(draft.image_url || selectedFile) && <button className="secondary-button" disabled={busy} type="button" onClick={() => { chooseFile(null); change('image_url',''); }}>Убрать фотографию</button>}
              </div>
            </div>
          </section>
          <section className="admin-panel admin-cms-form-section">
            <h2>Публикация</h2><p>Сохраняй новые карточки в черновиках до проверки сведений.</p>
            <div className="admin-form-grid">
              <label>Статус
                <select disabled={busy} value={draft.status} onChange={event => {change('status',event.target.value as AdminStatus);setConfirmed(false);}}>
                  <option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="archived">Архив</option>
                </select>
              </label>
              {draft.status === 'published' && <label className="admin-wide admin-confirm">
                <input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)}/>
                <span>Подтверждаю актуальность информации и право на использование фотографии.</span>
              </label>}
            </div>
            {message && <p role="status" className="admin-message">{message}</p>}
            <div className="admin-cms-form-actions">
              <button type="button" className="secondary-button" disabled={busy} onClick={() => setDraft(null)}>Отмена</button>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Сохраняем…' : draft.status === 'published' ? 'Проверить и опубликовать' : 'Сохранить карточку'}</button>
            </div>
          </section>
        </form> : screen === 'cities' && owner ? (cityDirectoryEnabled
          ? <CityManagement cities={directoryCities} refreshCities={refreshCities}
              onCitySaved={cityName => { setCityFilter(cityName); setCategoryFilter('all'); setFilter(''); }}/>
          : <section className="admin-panel"><h2>Подключение городов</h2><p>Настройка новых городов пока выключена до резервной копии и безопасного подключения Supabase.</p></section>
        ) : <>
          {screen === 'overview' && owner && <section className="admin-panel admin-cms-network" aria-label="Города сети">
            <div className="admin-cms-panel-heading">
              <div>
                <h2>Города сети</h2>
                <p>Выбери город, чтобы управлять его организациями. Новые города доступны даже до появления первой карточки.</p>
              </div>
              {cityDirectoryEnabled && <button className="admin-cms-link" type="button" onClick={() => navigateAdmin('cities')}>Настройки городов →</button>}
            </div>
            <div className="admin-cms-city-list">
              {cities.map(cityName => {
                const cityDefinition = directoryCities.find(entry => entry.name === cityName);
                const cityOrganizations = rows.filter(row => row.city === cityName);
                const cityPublished = cityOrganizations.filter(row => row.status === 'published').length;
                return <button type="button" key={cityName} onClick={() => { setCityFilter(cityName); navigateAdmin('catalog'); }}>
                  <strong>{cityName}</strong>
                  <small>{cityDefinition?.region ?? 'Регион не указан'}</small>
                  <span>{cityOrganizations.length} карточек · {cityPublished} опубликовано</span>
                  <span>Перейти к каталогу →</span>
                </button>;
              })}
            </div>
          </section>}
          {screen === 'overview' && owner && import.meta.env.VITE_VK_FEDERAL_POSTING_ENABLED === 'true' && <VkFederalComposer/>}
          {screen === 'overview' && <section className="admin-cms-stats" aria-label="Статистика каталога">
            <div><small>Действующие карточки</small><strong>{activeRows.length}</strong></div>
            <div><small>Опубликовано</small><strong>{published}</strong></div>
            <div><small>Черновики</small><strong>{draftCount}</strong></div>
          </section>}
          {screen !== 'photos' && <section className="admin-panel admin-cms-categories">
            <div className="admin-cms-panel-heading">
              <h2>Категории города</h2>
              {categoryFilter !== 'all' && <button type="button" className="admin-cms-link" onClick={() => setCategoryFilter('all')}>Показать все →</button>}
            </div>
            <p>Выбери раздел, чтобы посмотреть и изменить организации. Пустые разделы готовы для новых карточек.</p>
            {categories}
          </section>}
          {message && <p role="status" className="admin-message admin-cms-list-message">{message}</p>}
          <section className="admin-panel admin-cms-directory">
            <div className="admin-cms-panel-heading"><h2>{screen === 'overview' ? 'Последние карточки' : screen === 'photos' ? 'Организации с фотографиями' : selectedLabel}</h2>
              {screen === 'overview' && <button type="button" className="admin-cms-link" onClick={() => navigateAdmin('catalog')}>Все организации →</button>}
            </div>
            {screen !== 'overview' && <div className="admin-filters">
              <input aria-label="Поиск организаций" type="search" placeholder="Найти по названию или адресу" value={filter} onChange={event => setFilter(event.target.value)}/>
              <select aria-label="Тип организации" value={kindFilter} onChange={event => setKindFilter(event.target.value)}>
                <option>Все разделы</option><option value="places">Места</option><option value="services">Услуги</option>
              </select>
              <select aria-label="Статус организации" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option>Действующие</option><option>Все статусы</option><option value="published">Опубликовано</option><option value="draft">Черновики</option><option value="archived">Архив</option>
              </select>
            </div>}
            {filtered.length ? screen === 'overview' ? <div className="admin-cms-overview-items">{organizationCards}</div> : organizationCards
              : <p className="admin-empty">В этом разделе пока нет организаций. Можно добавить новую карточку.</p>}
          </section>
        </>}
      </div>
    </div>
  </div>;
}
