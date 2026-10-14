import type { Theme } from '../types';

// Match the pre-paint reader in index.html, including legacy unquoted values.
export function readTheme(): Theme {
  try {
    const raw = localStorage.getItem('ryadom.theme');
    let value: unknown = raw;
    try { value = JSON.parse(raw ?? 'null'); } catch { /* Legacy unquoted value. */ }
    // A dark-first city guide: migrate the old implicit 'system' default to dark.
    // Explicitly chosen light mode remains available in Profile settings.
    return value === 'light' || value === 'dark' ? value : 'dark';
  } catch { return 'dark'; }
}
