import { useEffect, useState } from 'react';
import type { Theme } from '../types';
import { saveStorage } from '../utils/storage';
import { readTheme, resolveTheme } from '../utils/theme';

const deviceScheme = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export function useTheme(compact: boolean) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(deviceScheme);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const sync = () => setSystemScheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(theme, systemScheme, compact);
    const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  }, [theme, systemScheme, compact]);
  // Keep the desktop preference when a user switches between mobile and desktop.
  useEffect(() => { saveStorage('ryadom.theme', theme); }, [theme]);
  return { theme, setTheme };
}
