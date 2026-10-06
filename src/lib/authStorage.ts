// Persist Supabase sessions/PKCE state, never OAuth provider access or refresh tokens.
const memory = new Map<string, string>();
function sanitize(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const session = parsed as Record<string, unknown>;
      delete session.provider_token;
      delete session.provider_refresh_token;
      return JSON.stringify(session);
    }
  } catch { /* PKCE state and storage strings need no session transformation. */ }
  return value;
}
export const authStorage = {
  getItem(key: string): string | null {
    try { const value = localStorage.getItem(key); return value === null ? null : sanitize(value); }
    catch { return memory.get(key) ?? null; }
  },
  setItem(key: string, value: string) {
    const safe = sanitize(value); memory.set(key, safe);
    try { localStorage.setItem(key, safe); } catch { /* In-memory fallback. */ }
  },
  removeItem(key: string) {
    memory.delete(key);
    try { localStorage.removeItem(key); } catch { /* In-memory fallback. */ }
  },
};
