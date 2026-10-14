export interface DirectoryCity {
  name: string;
  region: string;
  cover_url?: string | null;
  tagline?: string;
  summary?: string;
}

// Public fallback cities. The city-directory table can add more without a redeploy
// after its additive migration and deployment flag have been enabled.
export const availableCities: DirectoryCity[] = [
  { name: 'Енисейск', region: 'Красноярский край' },
  { name: 'Лесосибирск', region: 'Красноярский край' },
];

export const defaultCity = availableCities[0].name;

export function isAvailableCity(value: unknown, cities: readonly DirectoryCity[] = availableCities): value is string {
  return typeof value === 'string' && cities.some(city => city.name === value);
}

export function getCityDefinition(value: string, cities: readonly DirectoryCity[] = availableCities): DirectoryCity | undefined {
  return cities.find(city => city.name === value);
}
