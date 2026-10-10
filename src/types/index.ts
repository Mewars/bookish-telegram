import type { SourceMetadata } from '../import/types';
export type Section = 'home' | 'events' | 'places' | 'services' | 'profile' | 'favorites' | 'login' | 'consent' | 'privacy' | 'cookies' | 'terms' | 'contacts';
export type Kind = 'events' | 'places' | 'services';
export type Theme = 'system' | 'light' | 'dark';
export interface Item extends SourceMetadata {
  id: string; city: string; kind: Kind; title: string; category: string; image: string; description: string; details?: string;
  address?: string; price?: string; rating?: string; hours?: string; provider?: string;
  coordinates?: { lat: number; lon: number };
  yandexMapsUrl?: string;
  real?: boolean; phone?: string;
  dateOffset?: number; time?: string; label?: string;
}
export interface TelegramUser { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string }
export interface TelegramWebApp {
  ready(): void; expand(): void; initData?: string; initDataUnsafe?: { user?: TelegramUser };
  colorScheme?: 'light' | 'dark'; themeParams?: { bg_color?: string; text_color?: string; hint_color?: string; secondary_bg_color?: string; button_color?: string; button_text_color?: string };
  onEvent?(name: 'themeChanged', callback: () => void): void;
  offEvent?(name: 'themeChanged', callback: () => void): void;
  BackButton?: { show(): void; hide(): void; onClick(callback: () => void): void; offClick(callback: () => void): void };
}
declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }
