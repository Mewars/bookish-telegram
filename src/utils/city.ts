import type { Item } from '../types';

export function filterByCity(items: Item[], city: string): Item[] {
  return items.filter(item => item.city === city);
}
