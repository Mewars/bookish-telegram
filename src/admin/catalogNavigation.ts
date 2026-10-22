import {catalogGroups,matchesParent,matchesLeaf,type CatalogBranch} from '../../public/catalog/taxonomy.js';
import {requestCategory,requestCategoryGroups} from '../../public/catalog/requestCategories.js';
import {directoryCategories} from './directoryCategories';
import type {OrganizationRow} from '../organizations/model';

const styles:Record<string,string>={'Где поесть':'food','Гостиницы':'hotel','Магазины':'groceries','Банки и банкоматы':'bank','Госуслуги':'services','Здоровье':'health','Красота':'beauty','Авто':'car','Образование и молодёжь':'education','Общественные организации':'associations','ЖКХ':'housing','Парки и прогулки':'park','Достопримечательности':'landmark'};
const excluded=new Set(['Афиша','Объявления','Городская стена']);
export interface AdminCatalogGroup {id:string;label:string;value:string;kind:'places'|'services';color:string;path:string;branch?:CatalogBranch}
export const adminCatalogGroups:AdminCatalogGroup[]=catalogGroups.flatMap(g=>g.items).filter(p=>!excluded.has(p.name)).map(parent=>{
 const style=directoryCategories.find(s=>s.id===styles[parent.name]||s.value===parent.name)??directoryCategories.at(-1)!;
 const value=parent.name==='Где поесть'?'Кафе':parent.catalogCategory||parent.name;
 return {id:parent.name,label:parent.name,value,kind:requestCategoryGroups.find(g=>g.label===parent.name)?.options[0]?.kind??style.kind,color:style.color,path:style.path,branch:parent};
});
adminCatalogGroups.push({...directoryCategories.at(-1)!,id:'Другое'});
export function matchesAdminGroup(row:Pick<OrganizationRow,'category'|'title'>,id:string):boolean{
 if(id==='all')return true;
 const parent=adminCatalogGroups.find(g=>g.id===id)?.branch;
 return parent?matchesParent(row,parent):!adminCatalogGroups.some(g=>g.branch&&matchesParent(row,g.branch));
}
export function adminSubcategories(id:string){
 const parent=adminCatalogGroups.find(g=>g.id===id)?.branch;
 const options:{key:string;label:string;value:string;leaf:CatalogBranch}[]=[];
 if(!parent)return options;
 const visit=(branches:CatalogBranch[],path:string[]=[])=>{
  for(const leaf of branches){
   if(leaf.info||leaf.url)continue;
   const names=[...path,leaf.name];
   if(leaf.subs?.length){visit(leaf.subs,names);continue;}
   options.push({key:names.join(' / '),label:names.join(' / '),value:[parent.name==='Где поесть'?'Кафе':parent.catalogCategory||parent.name,...names].join(' / '),leaf});
  }
 };
 visit(parent.subs||[]);return options;
}
export function matchesAdminSubcategory(row:Pick<OrganizationRow,'category'|'title'>,id:string,key:string):boolean{
 if(key==='all')return true;
 const group=adminCatalogGroups.find(g=>g.id===id),sub=adminSubcategories(id).find(s=>s.key===key);
 return !!(group?.branch&&sub&&matchesLeaf(row,sub.leaf,group.branch));
}
export function adminGroupForRow(row:Pick<OrganizationRow,'category'|'title'>):string{
 const primary=row.category.split(' / ')[0];
 return adminCatalogGroups.find(g=>g.value===primary)?.id??adminCatalogGroups.find(g=>g.branch&&matchesAdminGroup(row,g.id))?.id??'Другое';
}
export function adminNewCategory(id:string,key:string){
 const group=adminCatalogGroups.find(g=>g.id===id)??adminCatalogGroups[0];
 const value=adminSubcategories(id).find(s=>s.key===key)?.value??group.value;
 return {category:value,kind:requestCategory(value)?.kind??group.kind};
}
