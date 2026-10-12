import type { Theme } from '../types';

// Match the pre-paint reader in index.html, including legacy unquoted values.
export function readTheme(): Theme {
  try {
    const raw = localStorage.getItem('ryadom.theme');
    let value: unknown = raw;
    try { value = JSON.parse(raw ?? 'null'); } catch { /* Legacy unquoted value. */ }
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch { return 'system'; }
}
