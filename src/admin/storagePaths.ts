/**
 * Deterministic, reversible, ASCII-only city prefix for Supabase Storage.
 * Supabase may reject non-ASCII object keys (e.g. "Енисейск/...": InvalidKey).
 *
 * Hexadecimal UTF-8 uniquely represents each exact city name, so different
 * cities cannot accidentally share the same namespace, unlike transliteration.
 * PostgreSQL RLS uses: 'city-' || encode(convert_to(city,'UTF8'),'hex').
 */
export function storageCityPrefix(city: string): string {
  if (!city || city.length > 100 || city !== city.trim() || city.includes('/')) {
    throw new Error('Некорректное название города для фотографии.');
  }
  const bytes = new TextEncoder().encode(city);
  return 'city-' + [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function storageAdminPhotoKey(city: string, id: string, ext: 'webp' | 'jpg'): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    throw new Error('Некорректный идентификатор фотографии.');
  }
  return `${storageCityPrefix(city)}/${id}.${ext}`;
}
