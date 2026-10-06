export const METRIKA_COUNTER_ID = 113480026;
const productionOrigin = 'https://ryadomcity.ru';
let initialized = false;
let listening = false;
let previousUrl: string | null = null;
const privateParams = new Set(['code', 'state', 'access_token', 'refresh_token', 'id_token', 'provider_token', 'provider_refresh_token', 'error_description', 'tgwebappdata', 'tgwebappthemeparams']);
function enabled() {
  return typeof window !== 'undefined' && import.meta.env.PROD && window.location.origin === productionOrigin;
}
function analyticsUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, productionOrigin);
    for (const key of [...url.searchParams.keys()]) if (privateParams.has(key.toLowerCase())) url.searchParams.delete(key);
    // OAuth/Telegram launch fragments must never become analytics URLs.
    if (url.hash && !/^#\/?(?:home|events|places|services|favorites|profile|login)(?:[/?]|$)/.test(url.hash)) url.hash = '';
    else if (url.hash.includes('?')) {
      const [route, query] = url.hash.split('?');
      const params = new URLSearchParams(query);
      for (const key of [...params.keys()]) if (privateParams.has(key.toLowerCase())) params.delete(key);
      url.hash = route + (params.size ? `?${params}` : '');
    }
    return url.href;
  } catch { return null; }
}
export function initYandexMetrika(): void {
  if (!enabled() || initialized) return;
  initialized = true;
  // Official ym queue allows calls before tag.js has finished loading.
  if (typeof window.ym !== 'function') {
    const queue: NonNullable<Window['ym']> = (...args: unknown[]) => { (queue.a ??= []).push(args); };
    queue.l = Date.now();
    window.ym = queue;
  }
  const source = 'https://mc.yandex.ru/metrika/tag.js';
  if (![...document.scripts].some(script => script.src === source)) {
    const script = document.createElement('script');
    script.src = source; script.async = true;
    document.head.append(script);
  }
  try {
    window.ym(METRIKA_COUNTER_ID, 'init', {
      defer: true, webvisor: true, clickmap: true, trackLinks: true, accurateTrackBounce: true,
    });
  } catch { /* Analytics must not interrupt the application. */ }
}
export function trackPageView(rawUrl?: string): void {
  if (!enabled()) return;
  initYandexMetrika();
  const url = analyticsUrl(rawUrl ?? window.location.href);
  if (!url || new URL(url).origin !== productionOrigin || url === previousUrl || typeof window.ym !== 'function') return;
  try {
    window.ym(METRIKA_COUNTER_ID, 'hit', url, {
      title: document.title,
      referer: previousUrl ?? analyticsUrl(document.referrer) ?? '',
    });
    previousUrl = url;
  } catch { /* Blocked/unavailable analytics leaves navigation usable. */ }
}
export function startYandexMetrikaTracking(): void {
  if (!enabled() || listening) return;
  listening = true;
  initYandexMetrika();
  trackPageView();
  const changed = () => trackPageView();
  window.addEventListener('hashchange', changed);
  window.addEventListener('popstate', changed);
}
