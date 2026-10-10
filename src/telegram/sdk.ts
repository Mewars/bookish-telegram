import type { TelegramWebApp } from '../types';

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';
const SDK_TIMEOUT_MS = 5000;
let loading: Promise<TelegramWebApp | undefined> | undefined;

export function getTelegramWebApp() {
  const candidate = window.Telegram?.WebApp;
  // The SDK also creates an empty WebApp stub in ordinary browsers.
  return candidate?.initData || candidate?.initDataUnsafe?.user ? candidate : undefined;
}

function isTelegramLaunch() {
  const hasLaunchParams = (params: URLSearchParams) => !!params.get('tgWebAppData') ||
    (params.has('tgWebAppPlatform') && params.has('tgWebAppVersion'));
  if (hasLaunchParams(new URLSearchParams(window.location.hash.slice(1))) ||
      hasLaunchParams(new URLSearchParams(window.location.search))) return true;
  try {
    // The official SDK caches launch parameters for reloads after hash navigation.
    // Read its existing cache only; do not persist launch data ourselves.
    const cached: unknown = JSON.parse(sessionStorage.getItem('__telegram__initParams') ?? 'null');
    return !!cached && typeof cached === 'object' && 'tgWebAppData' in cached &&
      typeof cached.tgWebAppData === 'string' && !!cached.tgWebAppData;
  } catch { return false; }
}

/** Called after React commits. Browser startup never waits for an external script. */
export function loadTelegramWebApp(): Promise<TelegramWebApp | undefined> {
  const existing = getTelegramWebApp();
  if (existing) return Promise.resolve(existing);
  if (!isTelegramLaunch()) return Promise.resolve(undefined);
  // Share one request across StrictMode effects and route remounts.
  if (loading) return loading;
  loading = new Promise(resolve => {
    const script = document.createElement('script');
    script.id = 'telegram-sdk';
    script.src = SDK_URL;
    script.async = true;
    const finish = (webApp?: TelegramWebApp) => {
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      if (!webApp) script.remove();
      resolve(webApp);
    };
    const timeout = window.setTimeout(() => finish(), SDK_TIMEOUT_MS);
    script.onload = () => finish(getTelegramWebApp());
    script.onerror = () => finish();
    try { document.head.append(script); } catch { finish(); }
  });
  return loading;
}
