export type IdentityProvider = 'telegram' | 'vk' | 'yandex' | 'google' | 'max';
export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  city: string;
  created_at: string;
  updated_at: string;
}
export interface UserIdentity {
  id: string;
  user_id: string;
  provider: IdentityProvider;
  provider_user_id: string;
  created_at: string;
}
export type ProfileUpdate = Partial<Pick<UserProfile, 'display_name' | 'avatar_url' | 'city'>>;
export type AuthState =
  | { status: 'loading'; user: null; profile: null; identities: UserIdentity[] }
  | { status: 'guest'; user: null; profile: null; identities: UserIdentity[] }
  | { status: 'authenticated'; user: { id: string }; profile: UserProfile | null; identities: UserIdentity[] };
