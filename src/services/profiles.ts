import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserIdentity, UserProfile, ProfileUpdate } from '../types/auth';
const profileFields = 'id,display_name,avatar_url,city,created_at,updated_at';
export async function readAccountData(client: SupabaseClient, userId: string) {
  const [profile, identities] = await Promise.all([
    client.from('profiles').select(profileFields).eq('id', userId).maybeSingle(),
    client.from('user_identities').select('id,user_id,provider,provider_user_id,created_at').eq('user_id', userId),
  ]);
  return {
    profile: profile.error ? null : profile.data as UserProfile | null,
    identities: identities.error ? [] : (identities.data ?? []) as UserIdentity[],
    error: profile.error || identities.error ? 'Не удалось загрузить данные профиля. Попробуйте обновить страницу.' : null,
  };
}
export async function updateCurrentProfile(client: SupabaseClient, userId: string, patch: ProfileUpdate, expected?: ProfileUpdate): Promise<UserProfile | null> {
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError || session?.user.id !== userId) throw new Error('Требуется текущая сессия пользователя.');
  // Explicit allowlist applies at runtime too: protected fields are never sent.
  const changes: ProfileUpdate = {};
  if (patch.display_name !== undefined) changes.display_name = patch.display_name;
  if (patch.avatar_url !== undefined) changes.avatar_url = patch.avatar_url;
  if (patch.city !== undefined) changes.city = patch.city;
  if (!Object.keys(changes).length) return null;
  let query = client.from('profiles').update(changes).eq('id', userId);
  if (expected?.display_name !== undefined) query = query.eq('display_name', expected.display_name);
  if (expected?.avatar_url !== undefined) query = expected.avatar_url === null ? query.is('avatar_url', null) : query.eq('avatar_url', expected.avatar_url);
  const { data, error } = await query.select(profileFields).maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}
