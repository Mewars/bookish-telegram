import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileUpdate, UserProfile } from '../types/auth';
import { readStorage, saveStorage } from '../utils/storage';
import { readAccountData, updateCurrentProfile } from './profiles';
const completed = new Set<string>();
const pending = new Map<string, Promise<UserProfile | null>>();
const value = (input: unknown) => typeof input === 'string' && input.trim() ? input : undefined;
export async function initializeYandexProfile(client: SupabaseClient, profile: UserProfile): Promise<UserProfile | null> {
  const key = `ryadom.profile.yandex-initialized.${profile.id}`;
  if (completed.has(profile.id) || readStorage(key, false, (v): v is boolean => typeof v === 'boolean')) return profile;
  if (pending.has(profile.id)) return pending.get(profile.id)!;
  const initialize = async () => {
    // getUser validates through Supabase Auth; cached session/Telegram metadata is not trusted here.
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || user.id !== profile.id) throw new Error('Не удалось проверить данные пользователя.');
    const isYandex = user.app_metadata.provider === 'custom:yandex' || user.app_metadata.providers?.includes('custom:yandex') || user.identities?.some(identity => identity.provider === 'custom:yandex');
    if (!isYandex) return profile;
    const metadata = user.user_metadata;
    const patch: ProfileUpdate = {};
    const expected: ProfileUpdate = {};
    const name = value(metadata.name) || value(metadata.full_name) || value(metadata.preferred_username);
    const avatar = value(metadata.picture) || value(metadata.avatar_url);
    if (!profile.display_name && name) { patch.display_name = name; expected.display_name = profile.display_name; }
    if (!profile.avatar_url && avatar) { patch.avatar_url = avatar; expected.avatar_url = profile.avatar_url; }
    const updated = Object.keys(patch).length ? await updateCurrentProfile(client, profile.id, patch, expected) : profile;
    // A concurrent edit fails the conditional update; never replace it with provider metadata.
    if (!updated) {
      const current = await readAccountData(client, profile.id);
      return current.profile;
    }
    completed.add(profile.id); saveStorage(key, true);
    return updated;
  };
  const result = initialize(); pending.set(profile.id, result);
  try { return await result; } finally { pending.delete(profile.id); }
}
