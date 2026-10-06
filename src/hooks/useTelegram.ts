import { useEffect, useState } from 'react';
import type { TelegramWebApp, Theme } from '../types';
import { readStorage, saveStorage } from '../utils/storage';
function getWebApp() {
  const candidate = window.Telegram?.WebApp;
  // The SDK also creates a WebApp stub in ordinary browsers.
  return candidate?.initData || candidate?.initDataUnsafe?.user ? candidate : undefined;
}
const deviceScheme = () => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
export function useTelegram() {
  const [webApp, setWebApp] = useState<TelegramWebApp | undefined>(getWebApp);
  const [theme, setTheme] = useState<Theme>(() => readStorage('ryadom.theme', 'system', (v): v is Theme => v === 'system' || v === 'light' || v === 'dark'));
  const [appearance, setAppearance] = useState(() => ({ scheme: webApp?.colorScheme ?? deviceScheme(), params: webApp?.themeParams }));
  useEffect(() => {
    const sdk = document.getElementById('telegram-sdk');
    const loaded = () => setWebApp(getWebApp());
    sdk?.addEventListener('load', loaded);
    return () => sdk?.removeEventListener('load', loaded);
  }, []);
  useEffect(() => {
    try { webApp?.ready(); webApp?.expand(); } catch { /* Browser fallback stays usable. */ }
    const media = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setAppearance({ scheme: webApp?.colorScheme ?? deviceScheme(), params: { ...webApp?.themeParams } });
    webApp?.onEvent?.('themeChanged', sync); media.addEventListener('change', sync);
    // SDK can finish loading after the first render.
    const timer = window.setTimeout(sync, 0);
    return () => { clearTimeout(timer); webApp?.offEvent?.('themeChanged', sync); media.removeEventListener('change', sync); };
  }, [webApp]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'system' ? appearance.scheme : theme;
    // Telegram supplies the light/dark scheme; brand colors stay consistent with web.
    for (const key of ['--bg', '--text', '--muted', '--surface', '--accent', '--accent-text']) {
      document.documentElement.style.removeProperty(key);
    }
    const resolved = theme === 'system' ? appearance.scheme : theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0D1520' : '#F4F8FB');
    saveStorage('ryadom.theme', theme);
  }, [theme, appearance]);
  return { user: webApp?.initDataUnsafe?.user, theme, setTheme, webApp };
}
