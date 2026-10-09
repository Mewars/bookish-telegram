import { clearMetrikaClientIdentifiers } from './metrikaCleanup';

export type CookieConsent = 'accepted' | 'necessary' | null;
const key = 'ryadom_cookie_consent_v1';
function readConsent(): CookieConsent {
  try {
    const value = localStorage.getItem(key);
    return value === 'accepted' || value === 'necessary' ? value : null;
  } catch { return null; }
}
let state = { consent: readConsent(), settingsOpen: false };
const listeners = new Set<() => void>();
function notify() { listeners.forEach(listener => listener()); }
export function getCookieConsent() { return state.consent; }
export function hasAnalyticsConsent() { return getCookieConsent() === 'accepted'; }
export function getConsentSnapshot() { return state; }
export function subscribeCookieConsent(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function save(consent: Exclude<CookieConsent, null>) {
  const revoked = state.consent === 'accepted' && consent === 'necessary';
  try { localStorage.setItem(key, consent); } catch { /* Keep the explicit decision for this visit only. */ }
  state = { consent, settingsOpen: false };
  notify();
  if (revoked) clearMetrikaClientIdentifiers();
}
export function acceptAnalytics() { save('accepted'); }
export function acceptNecessaryOnly() { save('necessary'); }
export function openCookieSettings() { state = { ...state, settingsOpen: true }; notify(); }
export function closeCookieSettings() { state = { ...state, settingsOpen: false }; notify(); }
window.addEventListener('storage', event => {
  if (event.key !== key && event.key !== null) return;
  const consent = readConsent();
  const revoked = state.consent === 'accepted' && consent === 'necessary';
  state = { ...state, consent };
  notify();
  if (revoked) clearMetrikaClientIdentifiers();
});
