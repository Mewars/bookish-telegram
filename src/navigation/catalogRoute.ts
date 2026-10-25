import {eventOnDay} from '../utils/events';
import { categoryParts, catalogGroups, matchesParent, matchesLeaf } from '../../public/catalog/taxonomy.js';
import type { Item, Kind } from '../types';

export interface CatalogFilters {
  query:string; category:string; subcategory:string; when:string;
}
export const emptyCatalogFilters:CatalogFilters={query:'',category:'Все',subcategory:'Все',when:'Все даты'};
export function isCatalogSection(value:string):value is Kind {
  return value==='places'||value==='events'||value==='services';
}
export function hashParts(hash:string) {
  const [path,search='']=hash.replace(/^#\/?/,'').split('?');
  const parts=path.split('/');
  let id:string|undefined;
  try { id=parts[1]?decodeURIComponent(parts[1]):undefined; } catch { id=undefined; }
  return {section:parts[0],id,params:new URLSearchParams(search),valid:parts.length<=2};
}
function limited(value:string|null,max:number):string {
  return value && value.length<=max && ![...value].some(char=>char.charCodeAt(0)<32)?value:'';
}
export function routeCity(hash:string):string {
  return limited(hashParts(hash).params.get('city'),100);
}
export function readCatalogFilters(hash:string):CatalogFilters {
  const {params}=hashParts(hash);
  const when=params.get('when');
  return {
    query:limited(params.get('q'),200),
    category:limited(params.get('category'),100)||'Все',
    subcategory:limited(params.get('subcategory'),100)||'Все',
    when:when==='Сегодня'||when==='Завтра'?when:'Все даты',
  };
}
export function catalogHash(kind:Kind,city:string,filters:CatalogFilters=emptyCatalogFilters):string {
  const params=new URLSearchParams();
  if(city)params.set('city',city);
  if(filters.query)params.set('q',filters.query);
  if(filters.category!=='Все')params.set('category',filters.category);
  if(filters.subcategory!=='Все')params.set('subcategory',filters.subcategory);
  if(kind==='events'&&filters.when!=='Все даты')params.set('when',filters.when);
  return '#/'+kind+(params.size?'?'+params.toString():'');
}
function homeSearchHash(city:string,query:string):string {
  return '#/home?'+new URLSearchParams({city,q:query}).toString();
}
export function rememberHomeSearch(city:string,query:string):void {
  if(hashParts(window.location.hash).section!=='home')return;
  const params=hashParts(window.location.hash).params;
  params.set('city',city);
  if(query)params.set('q',query.slice(0,200));else params.delete('q');
  window.history.replaceState(window.history.state,'','#/home?'+params.toString());
}
// Only a same-city public list may be a return destination. URLs, nested
// return parameters, detail pages, admin and profile routes are never used.
export function safeCatalogReturn(hash:string,kind:Kind,city:string):string {
  const current=hashParts(hash);
  const candidate=current.params.get('return');
  if(candidate?.startsWith('#/')) {
    const target=hashParts(candidate);
    if(target.valid && !target.id && routeCity(candidate)===city) {
      if(isCatalogSection(target.section))return catalogHash(target.section,city,readCatalogFilters(candidate));
      if(target.section==='home'&&readCatalogFilters(candidate).query)
        return homeSearchHash(city,readCatalogFilters(candidate).query);
    }
  }
  return catalogHash(kind,city);
}
export function detailHash(kind:Kind,id:string,city:string,fromHash:string):string {
  const origin=hashParts(fromHash);
  const homeQuery=origin.section==='home'?readCatalogFilters(fromHash).query:'';
  const back=origin.valid && !origin.id && homeQuery?homeSearchHash(city,homeQuery):origin.valid && !origin.id && isCatalogSection(origin.section)
    ? catalogHash(origin.section,city,readCatalogFilters(fromHash))
    : safeCatalogReturn(fromHash,kind,city);
  const params=new URLSearchParams();
  if(city)params.set('city',city);
  params.set('return',back);
  return '#/'+kind+'/'+encodeURIComponent(id)+'?'+params.toString();
}
export function matchesCatalogFilters(item:Item,filters:CatalogFilters,now=new Date()):boolean {
  const {category,subcategory}=categoryParts(item);
  const parent=catalogGroups.flatMap(group=>group.items).find(branch=>branch.name===filters.category);
  const leaves=(branches:typeof catalogGroups[number]['items']):typeof branches=>branches.flatMap(branch=>branch.subs?.length?leaves(branch.subs):[branch]);
  const leaf=parent?leaves(parent.subs||[]).find(branch=>branch.name===filters.subcategory):undefined;
  return (filters.category==='Все'||category===filters.category||(!!parent&&matchesParent(item,parent))) &&
    (filters.subcategory==='Все'||subcategory===filters.subcategory||(!!parent&&!!leaf&&matchesLeaf(item,leaf,parent))) &&
    (item.kind!=='events'||filters.when==='Все даты'||eventOnDay(item,filters.when==='Сегодня'?0:1,now));
}
