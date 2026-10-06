export interface SupabasePublicConfig { url: string; publishableKey: string }
export function getSupabaseConfig(): SupabasePublicConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    // Only the current public browser key format is accepted.
    if (!publishableKey.startsWith('sb_publishable_') || publishableKey.length <= 'sb_publishable_'.length || /\s/.test(publishableKey)) return null;
    return { url: parsed.origin, publishableKey };
  } catch { return null; }
}
