import type { Theme } from '../types';

// Desktop remembers a user's choice, including Auto. Mobile rendering is
// always dark but never erases the preference saved for the desktop.
export function readTheme(): Theme {
  try {
    const raw = localStorage.getItem('ryadom.theme');
    let value: unknown = raw;
    try { value = JSON.parse(raw ?? 'null'); } catch { /* Legacy unquoted value. */ }
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch { return 'system'; }
}

export function resolveTheme(preference: Theme, systemScheme: 'light' | 'dark', compact: boolean): 'light' | 'dark' {
  return compact ? 'dark' : preference === 'system' ? systemScheme : preference;
}
