const actor=()=>localStorage.getItem('catalog-actor')||'owner';
const source=()=>JSON.parse(localStorage.getItem('catalog-fixture-data')||JSON.stringify([
 {id:'1',title:'Кафе «Проба»',category:'Кафе',city:'Город А',kind:'places',status:'published',description:'Тестовая карточка'},
 {id:'2',title:'Бургерная «Проба»',category:'Кафе',city:'Город А',kind:'places',status:'draft',description:'Тестовый черновик'},
 {id:'3',title:'Пиццерия «Проба»',category:'Кафе',city:'Город Б',kind:'places',status:'published',description:'Тест другого города'},
 {id:'4',title:'Требует уточнения',category:'Кафе',city:'Город А',kind:'places',status:'archived',description:'Тестовый архив'}
]));
window.catalogRequests=[];
export function c(){return {
 auth:{getUser:async()=>({data:{user:{id:actor()}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 from(table){let filters=[],range=[0,499];const q={select(){return q},eq(key,value){filters.push([key,[value]]);return q},in(key,values){filters.push([key,values]);return q},order(){return q},range(start,end){range=[start,end];return q},then(resolve){
  let rows=[];
  if(table==='city_directory')rows=[{name:'Город А',active:true},{name:'Город Б',active:true},{name:'Новый город',active:true}];
  if(table==='city_admin_access')rows=[{user_id:actor(),city:actor()==='owner'?'*':'Город А',role:actor()==='owner'?'owner':'editor',active:true}];
  if(table==='organizations'){rows=source();window.catalogRequests.push({filters,range})}
  rows=rows.filter(row=>filters.every(([key,values])=>values.includes(row[key]))).slice(range[0],range[1]+1);
  return Promise.resolve({data:rows,error:null}).then(resolve);
 }};return q},
 rpc:async(name,args)=>{
  if(name!=='owner_edit_organization'||actor()!=='owner')return {data:null,error:{message:'Not authorized'}};
  const rows=source(),row=rows.find(row=>row.id===args.p_id);Object.assign(row,args.p_changes);localStorage.setItem('catalog-fixture-data',JSON.stringify(rows));return {data:null,error:null};
 }
}}
