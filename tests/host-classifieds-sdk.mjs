// Browser-only synthetic SDK fixture. Never deployed with the site.
const user={id:'seller',email:'synthetic@example.invalid'};
const row={id:'listing',city:'Енисейск',author_id:user.id,title:'Тестовый стол',
  description:'Полное описание синтетического объявления',deal_type:'sell',category:'Для дома',
  district:'Центр',price_rub:100,status:window.hostInitialStatus||'draft',created_at:new Date().toISOString()};
if(window.hostGigTest){row.deal_type='gig_offer';row.category='Подработка';row.title='Тестовое задание: перенести мебель';row.status='published';}
window.hostCalls=[];
const threadId='11111111-1111-4111-8111-111111111111';
const messageId=i=>String(i).padStart(8,'0')+'-1111-4111-8111-111111111111';
const messages=Array.from({length:225},(_,i)=>({id:messageId(i+1),conversation_id:threadId,
 sender_id:i%2?'buyer':user.id,body:'Сообщение '+(i+1),
 created_at:new Date(Date.UTC(2026,9,25,0,Math.floor(i/4))).toISOString()}));
class Query {
 constructor(table){this.table=table;this.filters=[];this.payload=null;this.one=false;this.orders=[];this.count=100;this.cursor=null;}
 range(){return this;} select(){return this;}
 order(key,{ascending}){this.orders.push([key,ascending]);return this;}
 limit(count){this.count=count;return this;}
 or(filter){this.cursor=filter;return this;}
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
  if(window.hostChatTest&&this.table==='classified_conversations'){
   const conversation={id:threadId,listing_id:row.id,buyer_id:'buyer',seller_id:user.id,created_at:row.created_at};
   result.data=this.one?conversation:[conversation];
  }
  if(window.hostChatTest&&this.table==='classified_messages'){
   if(this.cursor&&window.hostOlderFailures){
    window.hostOlderFailures--;return resolve({data:null,error:{message:'Synthetic history retry required'}});
   }
   let data=messages.filter(message=>this.filters.every(([key,values])=>values.includes(message[key])));
   if(this.cursor){
    const match=this.cursor.match(/^created_at\.lt\.(.+),and\(created_at\.eq\.(.+),id\.lt\.(.+)\)$/);
    if(!match)throw Error('Invalid cursor');
    data=data.filter(message=>message.created_at<match[1]||(message.created_at===match[2]&&message.id<match[3]));
   }
   data.sort((a,b)=>{for(const [key,ascending] of this.orders){const compared=a[key].localeCompare(b[key]);if(compared)return ascending?compared:-compared;}return 0;});
   result.data=data.slice(0,this.count);
  }
  return resolve(result);
 }
}
export const c=()=>({from:table=>new Query(table),
 auth:{getSession:async()=>({data:{session:{user}},error:null}),onAuthStateChange(){return {};},signOut:async()=>{}},
 rpc:async(name,args)=>{window.hostCalls.push({rpc:name,...args});
 if(window.hostChatTest&&name==='send_classified_message')messages.push({id:messageId(messages.length+1),conversation_id:threadId,sender_id:user.id,body:args.p_body,created_at:'2026-10-25T01:00:00.000Z'});if(name==='antispam_public_config')return {data:{auth_enabled:false,content_enabled:false,site_key:null},error:null};if(name==='begin_classified_revision')row.status='draft';return {data:null,error:null};}});
