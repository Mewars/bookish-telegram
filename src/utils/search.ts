import type { Item } from '../types';
export function matches(item: Item, query: string) {
 const normalize = (text: string) => text.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
 const text = normalize([item.title, item.category, item.description, item.address, item.provider ?? ''].join(' '));
 return normalize(query).trim().split(/\s+/).every(word => text.includes(word));
}
