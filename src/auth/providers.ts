import type { IdentityProvider } from '../types/auth';

// VK ID stays unavailable to regular visitors until the live OAuth flow is verified.
// The owner can opt into a limited test from https://ryadomcity.ru/?ryadom_vk_test=1#/login.
// This only controls frontend visibility, not server-side access control.
const vkPreviewEnabled =
  typeof window !== 'undefined' &&
  window.location.hostname === 'ryadomcity.ru' &&
  new URLSearchParams(window.location.search).get('ryadom_vk_test') === '1';

export const identityProviders: { id: IdentityProvider; label: string; status: 'enabled' | 'not-configured' }[] = [
  { id: 'vk', label: 'VK ID', status: import.meta.env.VITE_VK_ID_ENABLED === 'true' || vkPreviewEnabled ? 'enabled' : 'not-configured' },
  { id: 'yandex', label: 'Яндекс ID', status: 'enabled' },
];
