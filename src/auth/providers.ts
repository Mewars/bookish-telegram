import type { IdentityProvider } from '../types/auth';
export const identityProviders: { id: IdentityProvider; label: string; status: 'enabled' | 'not-configured' }[] = [
  { id: 'vk', label: 'VK ID', status: import.meta.env.VITE_VK_ID_ENABLED === 'true' ? 'enabled' : 'not-configured' },
  { id: 'yandex', label: 'Яндекс ID', status: 'enabled' },
];
