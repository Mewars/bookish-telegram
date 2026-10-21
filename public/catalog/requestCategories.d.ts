export interface RequestCategory {label:string;value:string;kind:'places'|'services'}
export const requestCategoryGroups:{label:string;options:RequestCategory[]}[];
export function requestCategory(value:string):RequestCategory|undefined;
