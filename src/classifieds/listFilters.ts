import type { Classified, DealType } from './repository';

// Search choices belong to the public browsing tab only.
// Applying them to "mine" or "moderate" hides drafts or pending reports.
export function visibleClassifiedListings(
  items:Classified[],tab:'browse'|'mine'|'moderate',deal:DealType|null,search:string,
):Classified[] {
  if(tab!=='browse')return items;
  const query=search.trim().toLocaleLowerCase('ru');
  return items.filter(entry=>(deal===null||entry.deal_type===deal) &&
    (!query||(entry.title+' '+entry.description+' '+entry.category)
      .toLocaleLowerCase('ru').includes(query)));
}
