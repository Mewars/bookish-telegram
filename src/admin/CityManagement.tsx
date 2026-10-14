import { useEffect, useState, type SubmitEvent } from 'react';
import type { DirectoryCity } from '../data/cities';
import { supabase } from '../lib/supabase';
import { prepareDirectoryPhoto } from '../photos/directoryPhotos';

const BUCKET = 'ryadom-city-covers';
const defaultTagline = 'Открывай город по-новому';
const defaultSummary = 'Места, события и полезные услуги города в одном месте.';

export function CityManagement({ cities, refreshCities }: {
  cities: readonly DirectoryCity[]; refreshCities: () => void;
}) {
  const [existing, setExisting] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [region, setRegion] = useState('Красноярский край');
  const [tagline, setTagline] = useState(defaultTagline);
  const [summary, setSummary] = useState(defaultSummary);
  const [coverUrl, setCoverUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const chooseImage = (next: File | null) => {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : '');
  };
  const reset = () => {
    setExisting(null); setName(''); setRegion('Красноярский край');
    setTagline(defaultTagline); setSummary(defaultSummary); setCoverUrl('');
    chooseImage(null); setFeedback('');
  };
  const edit = (city: DirectoryCity) => {
    setExisting(city.name); setName(city.name); setRegion(city.region);
    setTagline(city.tagline ?? defaultTagline);
    setSummary(city.summary ?? defaultSummary);
    setCoverUrl(city.cover_url ?? ''); chooseImage(null); setFeedback('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100 || trimmed.includes('/') || region.trim().length < 2
      || tagline.trim().length < 1 || !summary.trim()) {
      setFeedback('Проверь название, регион и описание города.'); return;
    }
    if (coverUrl) {
      try {
        const url = new URL(coverUrl);
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
      } catch { setFeedback('Для обложки нужна HTTPS-ссылка.'); return; }
    }
    setBusy(true); setFeedback('');
    let uploadedPath: string | null = null;
    try {
      let nextCover = coverUrl.trim() || null;
      if (file) {
        const optimized = await prepareDirectoryPhoto(file);
        const path = `covers/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage.from(BUCKET)
          .upload(path, optimized, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
        if (uploadError) throw new Error('Не удалось загрузить обложку. Проверь разрешения и хранилище.');
        uploadedPath = path;
        nextCover = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const values = { region: region.trim(), tagline: tagline.trim(), summary: summary.trim(), cover_url: nextCover };
      const request = existing
        ? supabase.from('city_directory').update(values).eq('name', existing)
        : supabase.from('city_directory').insert({ name: trimmed, ...values });
      const { error, data } = await request.select('name').single();
      if (error || !data) throw new Error('Город не сохранён. Проверь права главного администратора.');
      setExisting(trimmed); setCoverUrl(nextCover ?? ''); chooseImage(null);
      setFeedback('Город сохранён. Он появится в переключателе после обновления списка.');
      refreshCities();
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
      setFeedback(error instanceof Error ? error.message : 'Не удалось сохранить город.');
    } finally { setBusy(false); }
  };

  return <section className="admin-panel admin-cms-cities">
    <div className="admin-cms-panel-heading">
      <div><h2>Управление городами</h2>
        <p>Добавлять города может только владелец платформы. Администраторы франшиз видят только свой город.</p></div>
      <button className="secondary-button" onClick={reset} type="button">＋ Новый город</button>
    </div>
    <div className="admin-cms-city-list">
      {cities.map(city => <button type="button" key={city.name}
        className={existing === city.name ? 'is-selected' : ''} onClick={() => edit(city)}>
        <strong>{city.name}</strong><small>{city.region}</small><span>Изменить →</span>
      </button>)}
    </div>
    <form className="admin-cms-city-form" onSubmit={save} aria-busy={busy}>
      <h3>{existing ? 'Настройки города' : 'Подключить новый город'}</h3>
      <p>При подключении появится отдельный городской экран. Организации и события добавляются отдельно — чужие записи не копируются.</p>
      <div className="admin-form-grid">
        <label>Название города *
          <input required maxLength={100} disabled={busy || !!existing} value={name} onChange={event => setName(event.target.value)}
            placeholder="Например, Лесосибирск"/>
        </label>
        <label>Регион *
          <input required maxLength={120} disabled={busy} value={region} onChange={event => setRegion(event.target.value)}/>
        </label>
        <label className="admin-wide">Подзаголовок главного экрана
          <input required maxLength={160} disabled={busy} value={tagline} onChange={event => setTagline(event.target.value)}/>
        </label>
        <label className="admin-wide">Описание города на главном экране
          <textarea rows={3} required maxLength={300} disabled={busy} value={summary} onChange={event => setSummary(event.target.value)}/>
        </label>
        <label className="admin-wide">Ссылка на собственную обложку (необязательно)
          <input type="url" maxLength={1000} disabled={busy} value={coverUrl} onChange={event => setCoverUrl(event.target.value)} placeholder="https://"/>
        </label>
      </div>
      <div className="admin-cms-photo-picker">
        <div className="admin-cms-photo-preview">
          {(preview || coverUrl) ? <img src={preview || coverUrl} alt="Предпросмотр обложки города" loading="lazy"/> :
            <span>Нейтральный фон до загрузки реального фото</span>}
        </div>
        <label className="admin-cms-city-cover-label">Загрузить свою фотографию города
          <input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={event => chooseImage(event.target.files?.[0] ?? null)}/>
          <small>Только собственные или разрешённые изображения. Перед загрузкой снимок сжимается, EXIF и геометки удаляются.</small>
        </label>
      </div>
      {feedback && <p className="admin-message" role="status">{feedback}</p>}
      <div className="admin-cms-form-actions">
        <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Сохранение…' : existing ? 'Сохранить изменения' : 'Добавить город'}</button>
      </div>
    </form>
  </section>;
}
