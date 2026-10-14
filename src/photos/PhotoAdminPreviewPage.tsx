import { useMemo, useState, type ChangeEvent } from 'react';
import { catalog } from '../data/catalog';
import { Icon } from '../components/Icon';
import { MediaImage } from '../components/MediaImage';
import type { Item } from '../types';
import './photoAdmin.css';

// No Supabase client, authentication tokens or network writes are imported.
// Demonstration is only routed on Netlify and local development.
const cards = catalog.filter(item => item.city === 'Енисейск' && item.kind !== 'events');

export function PhotoAdminPreviewPage({ goHome }: { goHome: () => void }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState('');
  const [filename, setFilename] = useState('');
  const [demoPhotos, setDemoPhotos] = useState<Record<string,string>>({});
  const [notice, setNotice] = useState('');

  const selected = cards.find(item => item.id === selectedId);
  const list = useMemo(() => cards.filter(item =>
    [item.title,item.category,item.address ?? ''].some(value =>
      value.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))), [query]);

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setNotice('');
    if (!file) { setPreview(''); setFilename(''); return; }
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) {
      setNotice('Для демонстрации выбери JPG, PNG или WebP до 10 МБ.');
      setFilename(''); setPreview(''); return;
    }
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => setNotice('Не удалось открыть файл для предпросмотра.');
    reader.readAsDataURL(file);
  };
  const open = (item: Item) => { setSelectedId(item.id); setPreview(''); setFilename(''); setNotice(''); window.scrollTo({top:0,behavior:'smooth'}); };
  const saveDemo = () => {
    if (!selected || !preview) return;
    setDemoPhotos(old => ({...old,[selected.id]:preview}));
    setPreview(''); setFilename('');
    setNotice('Фото изменено только в этой демонстрации. На ryadomcity.ru ничего не загружено.');
  };
  const removeDemo = () => {
    if (!selected) return;
    setDemoPhotos(old => {const next={...old};delete next[selected.id];return next;});
    setPreview(''); setFilename('');
    setNotice('Демонстрационное изображение удалено. Настоящий сайт не изменён.');
  };

  return <div className="photo-admin-shell">
    <header className="photo-admin-heading"><div>
      <span className="eyebrow">РЯДОМ · ДЕМО АДМИНКИ</span>
      <h1>Фотографии организаций</h1>
      <p>Енисейск · {cards.length} карточек · просмотр без входа</p>
    </div><button className="secondary-button" onClick={goHome}>На сайт <Icon name="arrow" size={17}/></button></header>
    <div className="photo-admin-alert" role="status"><strong>Тестовая версия.</strong> Можно выбрать организацию, фотографию и нажать «Сохранить в демо». Ни один файл не уйдёт на сервер, реальный каталог не изменится.</div>
    {selected ? <section className="photo-admin-editor">
      <button type="button" className="back-link" onClick={() => {setSelectedId(null);setPreview('');setNotice('');}}><Icon name="back" size={18}/> К списку организаций</button>
      <h2>{selected.title}</h2><p>{selected.city}{selected.address ? ` · ${selected.address}` : ''}</p>
      <div className="photo-admin-image">{preview
        ? <img src={preview} alt="Предпросмотр выбранного изображения"/>
        : <MediaImage src={demoPhotos[selected.id] ?? selected.image} alt={`Изображение: ${selected.title}`}/>}</div>
      <p className="photo-admin-note">{preview ? 'Предпросмотр выбранного снимка (он ещё не сохранён).' :
        demoPhotos[selected.id] ? 'Фото сохранено только в памяти демо.' : 'Сейчас отображается исходная карточка без загруженного снимка.'}</p>
      <label className="photo-admin-file-label">Загрузить фотографию
        <input key={selected.id + filename} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto}/>
      </label>
      {filename && <p className="photo-admin-note">Выбранный файл: {filename}</p>}
      <div className="photo-admin-actions">
        <button type="button" className="primary-button" disabled={!preview} onClick={saveDemo}>Сохранить в демо</button>
        {demoPhotos[selected.id] && <button type="button" className="secondary-button" onClick={removeDemo}>Удалить фото (демо)</button>}
      </div>
      {notice && <p className="photo-admin-feedback" role="status">{notice}</p>}
    </section> : <section className="photo-admin-directory">
      <div className="photo-admin-filters"><input type="search" aria-label="Поиск организации" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название или адрес"/>
        <select aria-label="Город" value="Енисейск" disabled><option>Енисейск</option></select></div>
      <div className="photo-admin-list">
        {list.map(item=><button className="photo-admin-entry" key={item.id} type="button" onClick={()=>open(item)}>
          <span className="photo-admin-thumb"><MediaImage src={demoPhotos[item.id] ?? item.image} alt=""/></span>
          <span className="photo-admin-entry-copy">
            <strong>{item.title}</strong><small>{item.category} · {item.address ?? 'Енисейск'}</small>
            <em>{demoPhotos[item.id] ? 'Сохранено в демо' : 'Фото не загружено'}</em></span><Icon name="arrow" size={19}/>
        </button>)}
      </div>{!list.length && <p>По вашему запросу ничего не найдено.</p>}
    </section>}
  </div>;
}
