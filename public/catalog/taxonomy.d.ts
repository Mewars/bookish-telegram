export interface CatalogItem {category:string;title?:string;description?:string;status?:string}
export interface CatalogBranch {name:string;hint?:string;term?:string;foodKey?:string;subs?:CatalogBranch[];description?:string;icon?:string;catalogCategory?:string;url?:string;section?:string;info?:boolean}
export const catalogGroups:{title:string;items:CatalogBranch[]}[];
export const foodSubcategories:CatalogBranch[];
export function normalizeCategory(value:unknown):string;
export function isFoodCategory(value:string):boolean;
export function foodSubcategory(item:CatalogItem):CatalogBranch|null|undefined;
export function lodgingSubcategory(item:CatalogItem):CatalogBranch|null|undefined;
export function categoryParts(item:CatalogItem):{category:string;subcategory:string};
export function savedFoodCategory(key:string):string;
export function matchesParent(item:CatalogItem,parent:CatalogBranch):boolean;
export function matchesLeaf(item:CatalogItem,leaf:CatalogBranch,parent:CatalogBranch):boolean;
export function catalogCounts(items:CatalogItem[]):{total:number;published:number;unpublished:number};
