export function readStorage<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  try { const raw = localStorage.getItem(key); const value: unknown = raw ? JSON.parse(raw) : null; return validate(value) ? value : fallback; } catch { return fallback; }
}
export function saveStorage(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
