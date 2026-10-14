import { useEffect, useMemo, useState } from 'react';
import type { Item } from '../types';
import { catalog } from '../data/catalog';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Icon } from '../components/Icon';
import { MediaImage } from '../components/MediaImage';
import { EmptyState } from '../components/EmptyState';
import { readCityAccess } from '../admin/repository';
import { canManageCity, type CityAdminAccess } from '../admin/model';
import { CARD_PHOTO_CITY, removeDirectoryPhoto, uploadDirectoryPhoto } from './directoryPhotos';
import { useDirectoryPhotos } from './useDirectoryPhotos';
import './photoAdmin.css';

const manageableCards = catalog.filter(item => item.city === CARD_PHOTO_CITY && item.kind !== 'events');

export function PhotoAdminPage({ enabled, goHome, openLogin }: {
  enabled: boolean; goHome: () => void; openLogin: () => void;
}) {
  const { state } = useAuth();
  const userId = state.user?.id;
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  const [access, setAccess] = useState<CityAdminAccess[] | null>(null);
  const [accessError, setAccessError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const { items, photos, status, refresh } = useDirectoryPhotos(manageableCards, enabled);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'has' | 'missing'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [canPublish, setCanPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const client = supabase;
    if (!enabled || !userId || !client) return;
    let active = true;
    Promise.resolve().then(() => readCityAccess(client, userId)).then(result => {
      if (!active) return;
      setCheckedFor(userId);
      setAccess(result.filter(entry => canManageCity([entry], CARD_PHOTO_CITY)));
      setAccessError('');
    }).catch(error => {
      if (!active) return;
      setCheckedFor(userId);
      setAccess(null);
      setAccessError(error instanceof Error ? error.message : 'Не удалось проверить права.');
    });
    return () => { active = false; };
  }, [enabled, userId, attempt]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    let active = true;
    Promise.resolve().then(() => { if (active) setPreviewUrl(url); });
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);

  const photosById = useMemo(() => new Map(photos.map(photo => [photo.card_id, photo])), [photos]);
  const displayed = items.filter(item =>
    [item.title, item.category, item.address ?? ''].some(value => value.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))
    && (filter === 'all' || (filter === 'has' ? photosById.has(item.id) : !photosById.has(item.id)))
  );
  const selected: Item | undefined = selectedId ? items.find(item => item.id === selectedId) : undefined;
  const selectedPhoto = selected ? photosById.get(selected.id) : undefined;

  const choose = (id: string) => {
    setSelectedId(id);
    setFile(null);
    setCanPublish(false);
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!enabled || !supabase || !userId || !selected || !file || !access?.length || busy) return;
    if (!canPublish) { setMessage('Подтверди, что у тебя есть разрешение разместить фотографию.'); return; }
    setBusy(true); setMessage('');
    try {
      await uploadDirectoryPhoto(supabase, userId, selected, file);
      setFile(null); setPreviewUrl(''); setCanPublish(false);
      setMessage('Готово: фотография сохранена. Она появится в карточке для посетителей.');
      refresh();
      window.dispatchEvent(new Event('ryadom:card-photos-changed'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось сохранить фото.');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!supabase || !userId || !selectedPhoto || !access?.length || busy) return;
    if (!window.confirm('Убрать загруженную фотографию из карточки? Прежняя заглушка вернётся.')) return;
    setBusy(true); setMessage('');
    try {
      await removeDirectoryPhoto(supabase, userId, selectedPhoto);
      setFile(null);
      setMessage('Фотография удалена из карточки.');
      refresh();
      window.dispatchEvent(new Event('ryadom:card-photos-changed'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось удалить фото.');
    } finally { setBusy(false); }
  };

  if (!enabled) return <EmptyState title="Фотоадминка пока готовится" text="Безопасное подключение хранилища и прав администратора ещё не включено." action="На главную" onAction={goHome}/>;
  if (state.status === 'loading') return <p role="status">Проверяем вход в аккаунт «Рядом»…</p>;
  if (!userId) return <EmptyState title="Войди в свой аккаунт" text="Чтобы менять фотографии организаций, необходимо войти и получить права администратора." action="Войти" onAction={openLogin}/>;
  if (checkedFor !== userId) return <p role="status">Проверяем права администратора…</p>;
  if (accessError || !access?.length) return <div className="photo-admin-shell">
    <h1>Доступ к фотографиям</h1>
    <p role="alert">{accessError || 'У этого аккаунта нет прав на редактирование организаций Енисейска.'}</p>
    <p>Для выдачи прав понадобится ID твоего вошедшего аккаунта. Не присылай пароль или секретный ключ.</p>
    <code className="photo-admin-user-id">{userId}</code>
    <button className="secondary-button" onClick={() => { setCheckedFor(null); setAttempt(n => n + 1); }}>Повторить проверку</button>
  </div>;
  const loading = status === 'loading' || status === 'idle';
  return <div className="photo-admin-shell">
    <header className="photo-admin-heading">
      <div><span className="eyebrow">РЯДОМ · АДМИНИСТРАТОР</span><h1>Фотографии организаций</h1>
        <p>Енисейск · {manageableCards.length} карточек · {photos.length} с загруженными фото</p></div>
      <button className="secondary-button" onClick={goHome}>На сайт <Icon name="arrow" size={17}/></button>
    </header>
    <p className="photo-admin-explainer">Выбирай настоящие фотографии конкретных мест. Загруженное изображение появится на сайте без GitHub и ожидания публикации. Подойдут JPG, PNG, WebP и совместимые фото iPhone — они автоматически сжимаются до WebP. Геометки и EXIF удаляются при обработке.</p>
    {status === 'unavailable' && <div role="alert" className="photo-admin-alert">Хранилище временно недоступно. Не загружай фото, пока не восстановится соединение. <button className="secondary-button" onClick={refresh}>Повторить</button></div>}
    {selected ? <section className="photo-admin-editor" aria-busy={busy}>
      <button className="back-link" onClick={() => { setSelectedId(null); setFile(null); setPreviewUrl(''); setMessage(''); }} disabled={busy}><Icon name="back" size={18}/> К списку организаций</button>
      <h2>{selected.title}</h2><p>{selected.city}{selected.address ? ` · ${selected.address}` : ''}</p>
      <div className="photo-admin-image">
        {previewUrl ? <img src={previewUrl} alt="Выбранная фотография перед публикацией"/> : <MediaImage src={selected.image} alt={`Текущее изображение: ${selected.title}`}/>}
      </div>
      <p className="photo-admin-note">{previewUrl ? 'Предпросмотр. Изображение ещё не сохранено.' : selectedPhoto ? 'Сейчас используется загруженная фотография.' : 'Пока используется нейтральная иллюстрация либо ранее подтверждённый снимок.'}</p>
      <label className="photo-admin-file-label">Выбрать фотографию
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" disabled={busy || loading || status !== 'ready'} onChange={event => { setFile(event.target.files?.[0] ?? null); setPreviewUrl(''); setMessage(''); setCanPublish(false); }}/>
      </label>
      {file && <p className="photo-admin-note">Выбрано: {file.name} · {(file.size / 1024 / 1024).toFixed(1)} МБ</p>}
      <label className="photo-admin-confirm"><input type="checkbox" checked={canPublish} disabled={!file || busy} onChange={event => setCanPublish(event.target.checked)}/>
        <span>Это фотография данной организации, и у меня есть право разместить её на сайте.</span></label>
      <div className="photo-admin-actions">
        <button className="primary-button" onClick={() => { void save(); }} disabled={!file || !canPublish || busy || status !== 'ready'}>{busy ? 'Сохраняем…' : 'Сохранить фотографию'}</button>
        {selectedPhoto && <button className="secondary-button" onClick={() => { void remove(); }} disabled={busy || status !== 'ready'}>Удалить фото</button>}
      </div>
      {message && <p className="photo-admin-feedback" role="status">{message}</p>}
    </section> : <section className="photo-admin-directory">
      <div className="photo-admin-filters">
        <input type="search" placeholder="Название организации или адрес" aria-label="Найти организацию" value={query} onChange={event => setQuery(event.target.value)}/>
        <select aria-label="Фильтр фотографий" value={filter} onChange={event => setFilter(event.target.value as 'all' | 'has' | 'missing')}>
          <option value="all">Все карточки</option><option value="has">С фотографией</option><option value="missing">Без фотографии</option>
        </select>
      </div>
      <div className="photo-admin-list">{displayed.map(item => <button className="photo-admin-entry" key={item.id} onClick={() => choose(item.id)} disabled={loading || status !== 'ready'}>
        <span className="photo-admin-thumb"><MediaImage src={item.image} alt=""/></span>
        <span className="photo-admin-entry-copy"><strong>{item.title}</strong><small>{item.category} · {item.address ?? CARD_PHOTO_CITY}</small>
          <em>{photosById.has(item.id) ? 'Фото загружено' : 'Фото не загружено'}</em></span>
        <Icon name="arrow" size={19}/>
      </button>)}</div>
      {!displayed.length && <p>Поиск не дал результатов.</p>}
    </section>}
  </div>;
}
