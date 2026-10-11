import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/EmptyState';
import { applicationFields, emptyDraft, statusLabels, validateDraft } from './model';
import type { ApplicationDraft, ApplicationErrors, ApplicationRow } from './model';
import { readApplications, submitApplication } from './repository';
import './organizations.css';

export function OrganizationsPage({ enabled, mode, city, goBack, openLogin, openApplications }: {
  enabled: boolean; mode: 'add' | 'list'; city: string; goBack: () => void; openLogin: () => void; openApplications: () => void;
}) {
  const { state } = useAuth();
  const userId = state.user?.id;
  if (!enabled) return <EmptyState title="Приём заявок пока не открыт" text="Каталог мест продолжает работать. Новая функция появится после подготовки сервиса." action="Назад" onAction={goBack}/>;
  return <div className="organizations-page"><button className="back-link" onClick={goBack}><Icon name="back" size={18}/> Назад</button><div className="page-heading"><span className="eyebrow">КАТАЛОГ ГОРОДА</span><h1>{mode === 'add' ? 'Добавить организацию' : 'Мои заявки'}</h1><p>Сведения проверяются перед публикацией. Подача заявки не подтверждает владение организацией.</p></div>
    {state.status === 'loading' ? <p role="status">Проверяем состояние входа…</p> : !userId ? <EmptyState title="Войдите для подачи заявки" text="Авторизованный пользователь может отправить сведения и посмотреть только свои заявки." action="Войти" onAction={openLogin}/> : mode === 'add' ? <ApplicationForm key={userId} userId={userId} city={city} openApplications={openApplications}/> : <ApplicationList key={userId} userId={userId}/>}
  </div>;
}
function ApplicationForm({ userId, city, openApplications }: { userId: string; city: string; openApplications: () => void }) {
  const [draft, setDraft] = useState<ApplicationDraft>(() => emptyDraft(city));
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<ApplicationErrors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const requestId = useRef<string | null>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (locked.current) return;
    const checked = validateDraft(draft, consent);
    setErrors(checked); setMessage('');
    if (Object.keys(checked).length) {
      const first = Object.keys(checked)[0];
      document.getElementById(`organization-${first}`)?.focus();
      return;
    }
    locked.current = true; setBusy(true);
    try {
      requestId.current ??= crypto.randomUUID();
      await submitApplication(supabase, userId, draft, consent, requestId.current);
      if (mounted.current) setSuccess(true);
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : 'Не удалось отправить заявку. Попробуйте позже.'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  if (success) return <section className="organization-panel" role="status"><h2>Заявка отправлена</h2><p>Статус: «На рассмотрении». Организация появится в каталоге только после ручной проверки и публикации.</p><button className="primary-button" onClick={openApplications}>Мои заявки <Icon name="arrow" size={18}/></button></section>;
  return <form className="organization-panel organization-form" onSubmit={submit} noValidate aria-busy={busy}>
    <p>Указывайте сведения организации, которые можно опубликовать. Не отправляйте документы, пароли или чужие личные контакты. Поля со знаком * обязательны.</p>
    <fieldset disabled={busy}>{applicationFields.map(([key, label, limit, required]) => <div className={`organization-field ${['description', 'source_note'].includes(key) ? 'organization-wide' : ''}`} key={key}>
      <label htmlFor={`organization-${key}`}>{label}{required ? ' *' : ''}</label>
      {['description', 'source_note', 'hours'].includes(key) ? <textarea id={`organization-${key}`} name={key} maxLength={limit} required={required} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} rows={key === 'description' ? 5 : 3}/> : <input id={`organization-${key}`} name={key} maxLength={limit} required={required} type={key === 'phone' ? 'tel' : ['website', 'vk_url'].includes(key) ? 'url' : 'text'} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} placeholder={['website', 'vk_url'].includes(key) ? 'https://' : undefined}/>}
      {errors[key] && <small id={`error-${key}`} className="organization-error">{errors[key]}</small>}
      {key === 'source_note' && <small>Укажите ссылку или объясните, откуда получены сведения. Источник заявки не публикуется автоматически.</small>}
    </div>)}
    <div className="organization-wide"><label className="organization-consent"><input id="organization-consent" type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? 'error-consent' : undefined}/><span>Я даю отдельное <a href="#/organization-consent" target="_blank" rel="noopener noreferrer">согласие на обработку данных заявки</a> и публикацию проверенных сведений организации.</span></label>{errors.consent && <small id="error-consent" className="organization-error">{errors.consent}</small>}</div>
    <button className="primary-button organization-wide" type="submit">{busy ? 'Отправляем…' : 'Отправить на рассмотрение'}</button></fieldset>
    {message && <p className="organization-error" role="alert">{message}</p>}
    <button className="back-link" type="button" disabled={busy} onClick={openApplications}>Посмотреть мои заявки</button>
  </form>;
}
function ApplicationList({ userId }: { userId: string }) {
  const [result, setResult] = useState<{ rows?: ApplicationRow[]; error?: string }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    readApplications(supabase, userId).then(rows => { if (active) setResult({ rows }); }).catch(error => { if (active) setResult({ error: error instanceof Error ? error.message : 'Не удалось загрузить заявки.' }); });
    return () => { active = false; };
  }, [userId, attempt]);
  if (result.error) return <section className="organization-panel" role="alert"><p>{result.error}</p><button className="primary-button" onClick={() => { setResult({}); setAttempt(value => value + 1); }}>Повторить</button></section>;
  if (!result.rows) return <p role="status">Загружаем заявки…</p>;
  if (!result.rows.length) return <EmptyState title="Заявок пока нет" text="Начните с кнопки «Добавить организацию» в каталоге мест."/>;
  return <div className="organization-applications">{result.rows.map(row => <article className="organization-panel" key={row.id}><span className="organization-status">{statusLabels[row.status] ?? 'Статус уточняется'}</span><h2>{row.title}</h2><p>{row.city} · {row.address}</p><p>Отправлена: {new Date(row.created_at).toLocaleDateString('ru-RU')}</p>{row.review_message && <p>Ответ модератора: {row.review_message}</p>}{row.status === 'approved' && row.organization_id && <a className="back-link" href={`#/places/${encodeURIComponent(row.organization_id)}`}>Открыть опубликованную карточку</a>}</article>)}</div>;
}
