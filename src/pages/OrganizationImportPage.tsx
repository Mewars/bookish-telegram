import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandMark } from '../components/BrandMark';
import { useTelegram } from '../hooks/useTelegram';
import { checkFileSize, csvTemplate, parseOrganizationCsv } from '../import/csv';
import { downloadDate, downloadText } from '../import/download';
import { importFields, sourceTypes, type ImportRow, type OrganizationDraft } from '../import/types';
import { exportRecords, trimDraft, validateRows } from '../import/validation';
import '../import/import.css';
const pageSize = 25;
const statusLabels = { ready: '✓ Готово', warning: '⚠ Предупреждение', error: '✕ Ошибка' };
const requiredFields = new Set(['title', 'city', 'category', 'sourceUrl', 'sourceType']);

export function OrganizationImportPage() {
  const { theme, setTheme } = useTelegram();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [delimiter, setDelimiter] = useState('');
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ number: number; draft: OrganizationDraft } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const loadVersion = useRef({ version: 0 });
  const editButton = useRef<HTMLButtonElement | null>(null);
  const checked = useMemo(() => validateRows(rows), [rows]);
  const counts = {
    ready: checked.filter(row => row.status === 'ready').length,
    warning: checked.filter(row => row.status === 'warning').length,
    error: checked.filter(row => row.status === 'error').length,
    duplicate: checked.filter(row => row.duplicate).length,
  };
  const exportCount = rows.length - counts.error;
  useEffect(() => {
    const title = document.title;
    const loadState = loadVersion.current;
    document.title = 'Импорт организаций — Рядом';
    return () => { document.title = title; loadState.version++; };
  }, []);
  const editingNumber = editing?.number;
  useEffect(() => { if (editingNumber !== undefined) editorHeading.current?.focus(); }, [editingNumber]);
  async function load(file?: File) {
    if (!file) return;
    const version = ++loadVersion.current.version;
    setRows([]); setEditing(null); setConfirmed(false); setNotices([]); setFileName('');
    setError(''); setMessage(''); setPage(0); setLoading(true);
    try {
      checkFileSize(file.size);
      const bytes = await file.arrayBuffer();
      if (version !== loadVersion.current.version) return;
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new Error('Не удалось прочитать UTF-8. Сохраните CSV в кодировке UTF-8 и попробуйте снова.'); }
      const parsed = parseOrganizationCsv(text);
      setRows(parsed.rows); setDelimiter(parsed.delimiter); setNotices(parsed.notices); setFileName(file.name);
      setMessage(`Загружено организаций: ${parsed.rows.length}. Проверьте строки перед экспортом.`);
      requestAnimationFrame(() => previewHeading.current?.focus());
    } catch (failure) {
      if (version === loadVersion.current.version) setError(failure instanceof Error ? failure.message : 'Не удалось прочитать CSV.');
    } finally { if (version === loadVersion.current.version) setLoading(false); }
  }
  function closeEditor() { setEditing(null); requestAnimationFrame(() => editButton.current?.focus()); }
  function reset() {
    loadVersion.current.version++; setRows([]); setEditing(null); setConfirmed(false); setNotices([]);
    setFileName(''); setMessage('Данные импорта удалены из памяти страницы.'); setError(''); setLoading(false); setPage(0);
    if (input.current) input.current.value = '';
    input.current?.focus();
  }
  function save() {
    if (!editing) return;
    const draft = trimDraft(editing.draft);
    setRows(previous => previous.map(row => row.number === editing.number ? { ...row, draft, structuralErrors: [] } : row));
    setConfirmed(false);
    setMessage(`Строка №${editing.number} сохранена. Проверки и возможные дубли пересчитаны.`);
    closeEditor();
  }
  function exportJson() {
    if (!confirmed || !exportCount || editing || loading) return;
    try {
      const records = exportRecords(rows);
      downloadText(JSON.stringify(records, null, 2), `ryadom-organizations-${downloadDate()}.json`, 'application/json;charset=utf-8');
      setMessage(`JSON подготовлен: ${records.length} организаций. Строки с ошибками исключены.`);
    } catch { setError('Не удалось скачать JSON. Проверьте разрешение браузера на скачивание файлов.'); }
  }
  const visibleRows = checked.slice(page * pageSize, (page + 1) * pageSize);
  const selected = editing ? checked.find(row => row.number === editing.number) : undefined;
  return <div className="import-shell ym-disable-keys ym-disable-clicks ym-disable-webvisor">
    <header className="import-header"><a href="#/home" className="brand" aria-label="Рядом — на главную">рядом<BrandMark/></a>
      <label>Тема<select value={theme} onChange={event => setTheme(event.target.value as typeof theme)}><option value="system">Системная</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label>
    </header>
    <main className="import-page">
      <div className="import-heading"><span className="eyebrow">ВНУТРЕННИЙ ИНСТРУМЕНТ</span><h1>Импорт организаций</h1>
        <p>Инструмент работает локально в браузере. Файл и его содержимое никуда не отправляются.</p>
      </div>
      <p className="import-rights">Загружайте только данные, которые вы вправе использовать и публиковать в сервисе “Рядом”.</p>
      <ol className="import-steps" aria-label="Этапы импорта"><li>Загрузить CSV</li><li>Проверить</li><li>Исправить</li><li>Экспортировать</li></ol>
      <section className="import-panel" aria-labelledby="upload-heading"><div className="import-panel-title"><h2 id="upload-heading">1. Загрузить CSV</h2>
        <button className="import-secondary" onClick={() => downloadText(csvTemplate(), 'ryadom-organizations-template.csv', 'text/csv;charset=utf-8')}>Скачать шаблон CSV</button></div>
        <div className={`import-drop ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length !== 1) setError('Выберите один CSV-файл.'); else void load(event.dataTransfer.files[0]); }}>
          <strong>Перетащите CSV сюда или выберите файл</strong><p id="csv-help">UTF-8 · разделитель ; или , · до 5 MB. Кавычки и пустые поля поддерживаются.</p>
          <label className="import-file-label" htmlFor="organization-csv">Выбрать CSV-файл</label>
          <input ref={input} id="organization-csv" type="file" accept=".csv,text/csv" aria-describedby="csv-help" disabled={loading} onChange={event => { void load(event.target.files?.[0]); event.target.value = ''; }}/>
        </div>
        <p className="import-help">Обязательны: Название, Город, Категория, Источник, Тип источника. Допустимы русские заголовки и английские machine names. Координаты не ищутся автоматически. Фотографии не импортируются.</p>
        <details className="import-format"><summary>Все колонки и типы источника</summary><p>{importFields.map(([key, label]) => `${label} / ${key}`).join(' · ')}</p>
          <ul>{Object.entries(sourceTypes).map(([key, label]) => <li key={key}><code>{key}</code> — {label}</li>)}</ul>
          <p>Дата проверки: YYYY-MM-DD. Координаты: десятичные числа с точкой. Шаблон содержит демонстрационную строку; она не добавляется в каталог.</p></details>
      </section>
      <div className="import-feedback" aria-live="polite" role="status">{loading ? 'Читаем файл в браузере…' : message}</div>
      {error && <p className="import-error" role="alert">{error}</p>}
      {notices.map(notice => <p className="import-rights" key={notice}>{notice}</p>)}
      {!!rows.length && <>
        <section className="import-panel" aria-labelledby="preview-heading"><div className="import-panel-title"><div><h2 id="preview-heading" ref={previewHeading} tabIndex={-1}>2. Проверить организации</h2><p className="import-help">{fileName} · разделитель «{delimiter}». Номера строк включают заголовок и не учитывают пустые строки.</p></div><button className="import-secondary" onClick={reset}>Очистить импорт</button></div>
          <dl className="import-stats">{[['Всего строк', rows.length], ['Готово', counts.ready], ['С предупреждениями', counts.warning], ['С ошибками', counts.error], ['Возможных дублей', counts.duplicate]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {editing && <section className="import-editor" aria-labelledby="editor-heading"><h3 id="editor-heading" ref={editorHeading} tabIndex={-1}>3. Исправить строку №{editing.number}</h3>
            {selected && <ul className="import-problems">{[...selected.errors, ...selected.warnings].map(problem => <li key={problem}>{problem}</li>)}</ul>}
            <p className="import-help">Обязательные поля отмечены *. После сохранения проверки выполнятся снова. Данные останутся только в памяти страницы.</p>
            <form noValidate onSubmit={event => { event.preventDefault(); save(); }}><div className="import-fields">{importFields.map(([key, label]) => <label key={key} htmlFor={`import-${key}`}>{label}{requiredFields.has(key) ? ' *' : ''}
              {key === 'sourceType' ? <select id={`import-${key}`} value={editing.draft[key]} onChange={event => setEditing({ ...editing, draft: { ...editing.draft, [key]: event.target.value } })}>
                <option value="">Выберите тип источника</option>{editing.draft.sourceType && !Object.hasOwn(sourceTypes, editing.draft.sourceType) && <option value={editing.draft.sourceType}>Неизвестный: {editing.draft.sourceType}</option>}
                {Object.entries(sourceTypes).map(([value, text]) => <option key={value} value={value}>{value} — {text}</option>)}
              </select> : key === 'description' ? <textarea id={`import-${key}`} value={editing.draft[key]} onChange={event => setEditing({ ...editing, draft: { ...editing.draft, [key]: event.target.value } })}/> :
                <input id={`import-${key}`} type="text" inputMode={key === 'lat' || key === 'lon' ? 'decimal' : key === 'phone' ? 'tel' : undefined} placeholder={key === 'verifiedAt' ? 'YYYY-MM-DD' : undefined} autoComplete="off" value={editing.draft[key]} onChange={event => setEditing({ ...editing, draft: { ...editing.draft, [key]: event.target.value } })}/>}
            </label>)}</div><div className="import-actions"><button className="import-primary" type="submit">Сохранить строку</button><button className="import-secondary" type="button" onClick={closeEditor}>Отмена</button></div></form>
          </section>}
          <p className="import-help" id="table-help">Откройте строку кнопкой «Исправить». Таблицу можно прокручивать горизонтально с клавиатуры.</p>
          <div className="import-table-scroll" tabIndex={0} role="region" aria-label="Предпросмотр организаций" aria-describedby="table-help"><table><caption>Организации из CSV — предпросмотр</caption><thead><tr>{['Строка', 'Статус и проблемы', 'Название', 'Категория', 'Адрес', 'Телефон', 'Источник', 'Дата проверки', 'Действие'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{visibleRows.map(row => <tr key={row.number}><th scope="row">№{row.number}</th><td><span className={`import-status is-${row.status}`}>{statusLabels[row.status]}</span><ul className="import-problems">{[...row.errors, ...row.warnings].map(problem => <li key={problem}>{problem}</li>)}</ul></td>
              <td>{row.draft.title || '—'}<small>{row.draft.city || '—'}</small></td><td>{row.draft.category || '—'}</td><td>{row.draft.address || '—'}</td><td>{row.draft.phone || '—'}</td><td>{row.draft.sourceUrl || '—'}<small>{row.draft.sourceType || '—'}</small></td><td>{row.draft.verifiedAt || '—'}</td>
              <td><button className="import-secondary" aria-label={`Исправить строку №${row.number}`} onClick={event => { editButton.current = event.currentTarget; setEditing({ number: row.number, draft: { ...row.draft } }); }}>Исправить</button></td></tr>)}</tbody></table></div>
          {rows.length > pageSize && <div className="import-pagination"><button className="import-secondary" disabled={page === 0 || !!editing} onClick={() => setPage(value => value - 1)}>Назад</button><span>Страница {page + 1} из {Math.ceil(rows.length / pageSize)}</span><button className="import-secondary" disabled={(page + 1) * pageSize >= rows.length || !!editing} onClick={() => setPage(value => value + 1)}>Далее</button></div>}
        </section>
        <section className="import-panel" aria-labelledby="export-heading"><h2 id="export-heading">4. Экспортировать JSON</h2><p className="import-export-count">Будет экспортировано {exportCount} из {rows.length} организаций.</p>
          <p className="import-help">Строки с ошибками исключаются. Предупреждения и возможные дубли не блокируют экспорт и не удаляются автоматически. Пустые optional поля не попадут в JSON.</p>
          <label className="import-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>Я подтверждаю, что имею законное основание использовать и публиковать импортируемые данные.</label>
          {editing && <p className="import-help">Сохраните или отмените редактирование перед экспортом.</p>}
          <button className="import-primary" disabled={!confirmed || !exportCount || !!editing || loading} onClick={exportJson}>Скачать JSON</button>
        </section>
      </>}
      <p className="import-help">Данные импорта исчезнут после перезагрузки или выхода со страницы. Этот маршрут — внутренний инструмент, а не механизм ограничения доступа.</p>
    </main>
  </div>;
}
