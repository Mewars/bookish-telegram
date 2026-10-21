import assert from 'node:assert/strict';
import {test} from 'node:test';
import {catalogGroups,foodSubcategories,foodSubcategory,categoryParts,matchesLeaf,matchesParent,catalogCounts,savedFoodCategory} from '../public/catalog/taxonomy.js';
import {readManagedOrganizations} from '../public/catalog/adminData.js';
import {matches} from '../src/utils/search.ts';
import {matchesCatalogFilters,emptyCatalogFilters} from '../src/navigation/catalogRoute.ts';

const food=catalogGroups.flatMap(group=>group.items).find(parent=>parent.name==='Где поесть');
test('one food directory handles explicit formats without treating menu keywords as assignments',()=>{
 for(const [title,key] of [['Кафе «Тест»','cafe'],['Бургерная «Тест»','streetfood'],['Ресторан «Тест»','restaurant'],['Столовая «Тест»','canteen'],['Пиццерия «Тест»','pizza-sushi'],['Пекарня «Тест»','bakery']]){
  const item={category:'Кафе',title};
  assert.equal(foodSubcategory(item).foodKey,key);
  const leaf=foodSubcategories.find(sub=>sub.foodKey===key);
  assert(matchesLeaf(item,leaf,food));
  assert(matchesCatalogFilters({...item,kind:'places'},{...emptyCatalogFilters,category:'Кафе',subcategory:leaf.name}));
 }
 const unclear={category:'Кафе',title:'Тестовая организация',description:'Рядом ресторан, можно заказать пиццу, кофе и доставку'};
 assert.equal(foodSubcategory(unclear).foodKey,'unclassified');
 const explicit={category:savedFoodCategory('delivery'),title:'Пиццерия «Тест»'};
 assert.equal(foodSubcategory(explicit).foodKey,'delivery');
 assert.equal(foodSubcategory({category:'Музеи',title:'Кафе в музее'}),null);
 assert.deepEqual(categoryParts({category:'Музеи / История'}),{category:'Музеи',subcategory:'История'});
 assert.equal(foodSubcategories.length,9);
 assert.equal(foodSubcategory({category:'Кафе',title:'Проба',description:'Проба — служба доставки суши и роллов.'}).foodKey,'delivery');
 assert.equal(foodSubcategory({category:savedFoodCategory('unclassified'),title:'Пиццерия «Проба»'}).foodKey,'unclassified');
 for(const [category,key] of [['Бар','bar'],['Доставка еды','delivery']]){
  const item={category,title:'Проба'};
  assert(matchesParent(item,food));
  assert.equal(foodSubcategory(item).foodKey,key);
 }
});
test('food subcategory counts partition the same city rows, including unpublished and archived cards',()=>{
 const rows=[{city:'Город А',category:'Кафе',title:'Кафе «Тест»',status:'published'},{city:'Город А',category:'Кафе',title:'Бургерная «Тест»',status:'draft'},{city:'Город А',category:'Кафе',title:'Неуточнённый формат',status:'archived'},{city:'Город Б',category:'Кафе',title:'Кафе «Другое»',status:'published'}];
 const current=rows.filter(item=>item.city==='Город А');
 assert.deepEqual(catalogCounts(current),{total:3,published:1,unpublished:2});
 const counts=foodSubcategories.map(sub=>catalogCounts(current.filter(item=>matchesParent(item,food)&&matchesLeaf(item,sub,food))));
 assert.equal(counts.reduce((n,c)=>n+c.total,0),3);
 assert.equal(counts.reduce((n,c)=>n+c.published,0),1);
 assert.deepEqual(catalogCounts([]),{total:0,published:0,unpublished:0});
});
test('managed counts page beyond 1000 rows and narrow every editor query to assigned cities',async()=>{
 const rows=Array.from({length:1001},(_,i)=>({id:String(i),city:'Город А',status:i%2?'draft':'published'}));
 const ranges=[],scopes=[];
 const client={from(table){assert.equal(table,'organizations');let range;return {select(){return this},order(){return this},range(start,end){range=[start,end];ranges.push(range);return this},in(field,cities){assert.equal(field,'city');scopes.push(cities);return this},then(resolve){return Promise.resolve({data:rows.slice(range[0],range[1]+1),error:null}).then(resolve)}}}};
 const result=await readManagedOrganizations(client,[{active:true,city:'Город А',role:'editor'}]);
 assert.equal(result.length,1001);
 assert.deepEqual(ranges,[[0,499],[500,999],[1000,1499]]);
 assert.deepEqual(scopes,[['Город А'],['Город А'],['Город А']]);
 assert.deepEqual(await readManagedOrganizations(null,[{active:false,city:'*',role:'owner'}]),[]);
 assert.deepEqual(await readManagedOrganizations(null,[{active:true,city:'*',role:'editor'}]),[]);
});

test('organization requests use the public category tree and retain the selected branch',async()=>{
 const {requestCategoryGroups,requestCategory}=await import('../public/catalog/requestCategories.js');
 assert(requestCategoryGroups.length>10);
 for(const group of requestCategoryGroups){
  const parent=catalogGroups.flatMap(g=>g.items).find(p=>p.name===group.label);
  for(const option of group.options){
   assert(option.value.length<=100,option.value);
   assert(matchesParent({category:option.value},parent),option.value);
   assert(matchesCatalogFilters({kind:option.kind,category:option.value},{...emptyCatalogFilters,category:group.label,subcategory:option.label.split(' / ').at(-1)}),option.value);
   assert.equal(requestCategory(option.value)?.value,option.value);
   assert(matches({title:'Проверенная организация',category:option.value,description:'Описание',kind:option.kind},option.term),option.value);
  }
 }
 assert.equal(requestCategory('Кафе / Пиццерии и суши').kind,'places');
 const services=requestCategoryGroups.find(g=>g.label==='Услуги и мастера');
 assert(services.options.every(o=>o.kind==='services'));
});
