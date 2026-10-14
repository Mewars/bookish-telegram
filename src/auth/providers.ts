import type { IdentityProvider } from '../types/auth';

// This flag is enabled by the reviewed production build workflows.
// Supabase Auth owns the actual OAuth2 session and PKCE security checks.
export const identityProviders: { id: IdentityProvider; label: string; status: 'enabled' | 'not-configured' }[] = [
  { id: 'vk', label: 'VK ID', status: import.meta.env.VITE_VK_ID_ENABLED === 'true' ? 'enabled' : 'not-configured' },
  { id: 'yandex', label: 'Яндекс ID', status: 'enabled' },
];
