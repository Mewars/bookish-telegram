import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { acceptAnalytics, acceptNecessaryOnly, closeCookieSettings, getConsentSnapshot, subscribeCookieConsent } from './cookieConsent';
import './cookieBanner.css';

export function CookieBanner() {
  const { consent, settingsOpen } = useSyncExternalStore(subscribeCookieConsent, getConsentSnapshot);
  const [details, setDetails] = useState(false);
  const banner = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const visible = consent === null || settingsOpen;
  useEffect(() => {
    const element = banner.current;
    if (!visible || !element) return;
    const measure = () => document.documentElement.style.setProperty('--cookie-banner-height', `${element.getBoundingClientRect().height + 20}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--cookie-banner-height'); };
  }, [visible, settingsOpen]);
  useEffect(() => {
    const element = dialog.current;
    if (!settingsOpen || !element) return;
    element.showModal();
    return () => { element.close(); };
  }, [settingsOpen]);
  if (!visible) return null;
  const content = <section ref={banner} className="cookie-banner" aria-labelledby="cookie-title">
    <h2 id="cookie-title">{settingsOpen ? 'Настройки cookie' : 'Файлы cookie'}</h2>
    <p>Мы используем необходимые файлы cookie для работы сайта и, с вашего согласия, Яндекс Метрику для анализа посещаемости.</p>
    {settingsOpen && <p className="cookie-current">Аналитика: {consent === 'accepted' ? 'включена' : 'выключена'}</p>}
    <button className="cookie-details-toggle" onClick={() => setDetails(value => !value)} aria-expanded={details} aria-controls="cookie-details">{details ? 'Скрыть подробности' : 'Подробнее'}</button>
    {details && <div id="cookie-details" className="cookie-details"><p><strong>Необходимые:</strong> Нужны для сохранения настроек сайта и работы основных функций.</p><p><strong>Аналитические:</strong> Яндекс Метрика помогает нам понимать, как используется сайт. Включается только с вашего согласия.</p></div>}
    <div className="cookie-actions"><button onClick={acceptAnalytics}>Принять</button><button onClick={acceptNecessaryOnly}>Только необходимые</button></div>
    {settingsOpen && <button className="cookie-settings-close" onClick={closeCookieSettings} aria-label="Закрыть настройки cookie без изменения выбора">Закрыть</button>}
  </section>;
  return settingsOpen ? <dialog ref={dialog} className="cookie-dialog" aria-labelledby="cookie-title" onCancel={closeCookieSettings}>{content}</dialog> : content;
}
