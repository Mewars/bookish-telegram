import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserIdentity, UserProfile, ProfileUpdate } from '../types/auth';
import { readAccountData, updateCurrentProfile } from './profiles';

// Display only an identity that Supabase Auth verified. Never write user_identities here.
export async function initializeVkAccount(client: SupabaseClient, profile: UserProfile) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.id!==profile.id) throw new Error('Не удалось проверить аккаунт.');
  const identity=user.identities?.find(entry=>entry.provider==='custom:vk');
  if (!identity) return { profile,identity:null };
  const data=identity.identity_data??{};
  const patch: ProfileUpdate={},expected: ProfileUpdate={};
  if (!profile.display_name && typeof data.name==='string' && data.name.trim()) {
    patch.display_name=data.name.trim().slice(0,160); expected.display_name=profile.display_name;
  }
  const picture=data.picture??data.avatar_url;
  if (!profile.avatar_url && typeof picture==='string') {
    try {
      const url=new URL(picture);
      if (url.protocol==='https:' && !url.username && !url.password) { patch.avatar_url=url.href; expected.avatar_url=profile.avatar_url; }
    } catch { /* No invalid avatar. */ }
  }
  const updated=Object.keys(patch).length?await updateCurrentProfile(client,profile.id,patch,expected):profile;
  const result=updated??(await readAccountData(client,profile.id)).profile;
  const verified: UserIdentity={id:identity.identity_id,user_id:user.id,provider:'vk',provider_user_id:identity.id,created_at:identity.created_at??user.created_at};
  return {profile:result,identity:verified};
}
