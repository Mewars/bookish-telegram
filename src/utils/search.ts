import {requestCategory} from '../../public/catalog/requestCategories.js';
import { categoryParts,lodgingSubcategory } from '../../public/catalog/taxonomy.js';
import type { Item } from '../types';
export function matches(item: Item, query: string) {
 const normalize = (text: string) => text.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
 const lodging=lodgingSubcategory(item);
 const text = normalize([item.title, item.category, requestCategory(item.category)?.term??'', categoryParts(item).subcategory, lodging?`гостиницы ${lodging.name}`:'', item.description, item.address ?? '', item.provider ?? ''].join(' '));
 return normalize(query).trim().split(/\s+/).every(word => text.includes(word));
}
