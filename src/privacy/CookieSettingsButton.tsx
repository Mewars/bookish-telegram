import { openCookieSettings } from './cookieConsent';
export function CookieSettingsButton() {
  return <button className="cookie-settings-link" onClick={openCookieSettings} aria-haspopup="dialog">Настройки cookie</button>;
}
