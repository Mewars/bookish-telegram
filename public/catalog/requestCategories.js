import {catalogGroups,savedFoodCategory} from './taxonomy.js';
const serviceParents=new Set(['Услуги и мастера','Банки и банкоматы','Аптеки','Госуслуги','Образование и молодёжь','Здоровье','Красота','Авто','Общественные организации','ЖКХ']);
const excluded=new Set(['Афиша','Объявления','Городская стена']);
export const requestCategoryGroups=catalogGroups.flatMap(group=>group.items).filter(parent=>!excluded.has(parent.name)).map(parent=>{
 const options=[];
 const visit=(branches,path=[])=>{
  for(const branch of branches){
   if(branch.info||branch.url)continue;
   const parts=[...path,branch.name];
   if(branch.subs?.length){visit(branch.subs,parts);continue;}
   const value=branch.foodKey?savedFoodCategory(branch.foodKey):[parent.catalogCategory||parent.name,...parts].join(' / ');
   options.push({label:parts.join(' / '),value,term:branch.term||branch.name,kind:serviceParents.has(parent.name)?'services':'places'});
  }
 };
 visit(parent.subs||[]);
 return {label:parent.name,options};
});
export function requestCategory(value){return requestCategoryGroups.flatMap(group=>group.options).find(option=>option.value===value);}
