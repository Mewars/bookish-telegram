import type { SourceMetadata } from '../import/types';
export type Section = 'home' | 'events' | 'places' | 'services' | 'profile' | 'favorites' | 'login' | 'consent' | 'privacy' | 'cookies' | 'terms' | 'contacts' | 'add-organization' | 'my-applications' | 'organization-consent' | 'admin' | 'admin-preview';
export type Kind = 'events' | 'places' | 'services';
export type Theme = 'system' | 'light' | 'dark';
export interface Item extends SourceMetadata {
  id: string; city: string; kind: Kind; title: string; category: string; image: string; description: string; details?: string;
  address?: string; price?: string; rating?: string; hours?: string; provider?: string;
  coordinates?: { lat: number; lon: number };
  yandexMapsUrl?: string;
  website?: string; vkUrl?: string;
  real?: boolean; phone?: string;
  // Licensed image metadata. Stock photos must never be mistaken for an actual venue.
  photoIllustrative?: boolean; photoCredit?: string; photoSourceUrl?: string; photoLicenseUrl?: string;
  dateOffset?: number; time?: string; label?: string;
}
