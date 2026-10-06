export const availableCities = [
  { name: 'Енисейск', region: 'Красноярский край' },
] as const;

export const defaultCity = availableCities[0].name;

export function isAvailableCity(value: unknown): value is string {
  return typeof value === 'string' && availableCities.some(city => city.name === value);
}
