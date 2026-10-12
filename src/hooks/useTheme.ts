import { useEffect, useState } from 'react';
import type { Theme } from '../types';
import { saveStorage } from '../utils/storage';
import { readTheme } from '../utils/theme';

const deviceScheme = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [systemScheme, setSystemScheme] = useState(deviceScheme);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const sync = () => setSystemScheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'system' ? systemScheme : theme;
    const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
    saveStorage('ryadom.theme', theme);
  }, [theme, systemScheme]);
  return { theme, setTheme };
}
