import type { IdentityProvider } from '../types/auth';
export const identityProviders: { id: IdentityProvider; label: string; status: 'enabled' | 'not-configured' | 'coming-soon' }[] = [
  { id: 'vk', label: 'VK ID', status: 'not-configured' },
  { id: 'yandex', label: 'Яндекс ID', status: 'enabled' },
  { id: 'telegram', label: 'Telegram', status: 'not-configured' },
  { id: 'google', label: 'Google', status: 'not-configured' },
  { id: 'max', label: 'MAX', status: 'coming-soon' },
];
