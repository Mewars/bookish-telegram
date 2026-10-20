// Browser-only synthetic SDK fixture. Never deployed with the site.
const user={id:'seller',email:'synthetic@example.invalid'};
const row={id:'listing',city:'Енисейск',author_id:user.id,title:'Тестовый стол',
  description:'Полное описание синтетического объявления',deal_type:'sell',category:'Для дома',
  district:'Центр',price_rub:100,status:window.hostInitialStatus||'draft',created_at:new Date().toISOString()};
window.hostCalls=[];
class Query {
 constructor(table){this.table=table;this.filters=[];this.payload=null;this.one=false;}
 select(){return this;} order(){return this;} limit(){return this;}
 eq(k,v){this.filters.push([k,[v]]);return this;} in(k,v){this.filters.push([k,v]);return this;}
 update(payload){this.payload=payload;return this;}
 single(){this.one=true;return this;} maybeSingle(){this.one=true;return this;}
 async then(resolve){
  let result={data:[],error:null};
  if(this.table==='city_directory')result.data=[{name:'Енисейск'},{name:'Лесосибирск'}];
  if(this.table==='classifieds') {
   const matches=this.filters.every(([k,values])=>values.includes(row[k]));
   if(this.payload){
    window.hostCalls.push({...this.payload});
    if('city' in this.payload)result.error={message:'permission denied for table classifieds'};
    else if(matches&&!window.hostZeroUpdate){Object.assign(row,this.payload);result.data=this.one?{id:row.id}:[];}
    else result.data=this.one?null:[];
   } else result.data=this.one?(matches?{...row}:null):(matches?[{...row}]:[]);
  }
  return resolve(result);
 }
}
export const c=()=>({from:table=>new Query(table),
 auth:{getSession:async()=>({data:{session:{user}},error:null}),onAuthStateChange(){return {};},signOut:async()=>{}},
 rpc:async(name)=>{window.hostCalls.push({rpc:name});if(name==='begin_classified_revision')row.status='draft';return {data:null,error:null};}});
