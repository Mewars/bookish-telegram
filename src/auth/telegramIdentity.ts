import type { TelegramWebApp } from '../types';
export interface TelegramIdentityRequest { provider: 'telegram'; initData: string }
// Send only via HTTPS POST to the future auth backend. Never persist or log initData.
// This payload is untrusted until the server validates signature, auth_date and replay limits.
export function getTelegramIdentityRequest(webApp?: TelegramWebApp): TelegramIdentityRequest | null {
  return webApp?.initData ? { provider: 'telegram', initData: webApp.initData } : null;
}
