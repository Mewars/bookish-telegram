import type { SupabaseClient } from '@supabase/supabase-js';

export type WebsiteOAuthProvider = 'vk' | 'yandex';

// Supabase owns state, PKCE, callback verification and the resulting Auth session.
export function startWebsiteOAuth(client: SupabaseClient, provider: WebsiteOAuthProvider, redirectTo: string) {
  return client.auth.signInWithOAuth({
    provider: provider === 'vk' ? 'custom:vk' : 'custom:yandex',
    options: { redirectTo },
  });
}
