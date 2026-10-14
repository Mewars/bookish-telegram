import type { Item } from '../types';
import type { AdminStatus } from './model';

// Browser-only rehearsal data: never sent to Supabase, GitHub or a remote API.
export const PREVIEW_STORAGE_KEY = 'ryadom.admin.rehearsal.v1';
export type PreviewRow = { item: Item; status: AdminStatus };

export function readPreviewEdits(raw: string | null): PreviewRow[] {
  if (!raw || raw.length > 4_000_000) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const rows: PreviewRow[] = [];
    for (const value of parsed.slice(0, 60)) {
      if (typeof value !== 'object' || value === null) continue;
      const data = value as Record<string, unknown>;
      const item = data.item as Record<string, unknown> | null;
      if (!item || typeof item !== 'object') continue;
      if (typeof item.id !== 'string' || !/^[a-z0-9_-]{1,100}$/i.test(item.id)) continue;
      if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 160) continue;
      if (typeof item.description !== 'string' || item.description.length > 2000) continue;
      if (typeof item.category !== 'string' || item.category.length > 100) continue;
      if (item.kind !== 'places' && item.kind !== 'services') continue;
      if (item.city !== 'Енисейск' && item.city !== 'Лесосибирск') continue;
      if (data.status !== 'draft' && data.status !== 'published' && data.status !== 'archived') continue;
      // Only thumbnail data URLs created from a local browser image are retained.
      const image = typeof item.image === 'string' && /^data:image\/(webp|png|jpeg);base64,[a-z\d+/=]+$/i.test(item.image)
        && item.image.length < 700_000 ? item.image : '';
      rows.push({
        item: {
          id: item.id, title: item.title, description: item.description, category: item.category,
          kind: item.kind, city: item.city, image,
          real: true,
          address: typeof item.address === 'string' ? item.address.slice(0, 300) : undefined,
          phone: typeof item.phone === 'string' ? item.phone.slice(0, 40) : undefined,
          hours: typeof item.hours === 'string' ? item.hours.slice(0, 300) : undefined,
          website: typeof item.website === 'string' ? item.website.slice(0, 500) : undefined,
          vkUrl: typeof item.vkUrl === 'string' ? item.vkUrl.slice(0, 500) : undefined,
          sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl.slice(0, 500) : undefined,
        },
        status: data.status,
      });
    }
    return rows;
  } catch { return []; }
}

export function previewRows(baseline: PreviewRow[], edits: PreviewRow[]): PreviewRow[] {
  const additions = new Map(baseline.map(row => [row.item.id, row]));
  for (const row of edits) {
    const previous = additions.get(row.item.id);
    additions.set(row.item.id, { ...row, item: { ...row.item, image: row.item.image || previous?.item.image || '' } });
  }
  return [...additions.values()];
}
