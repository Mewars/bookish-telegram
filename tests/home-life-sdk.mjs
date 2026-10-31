/* global window */
export function c(){return {
 async rpc(){return {data:null,error:{code:'PGRST202'}};},auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:null}};}},
 from(table){const filters={};const query={then(resolve,reject){const city=filters.city;const common={city,status:'published'};const records=city==='Пустой город'?[]:table==='classifieds'?[{...common,id:'ad-'+city,title:'Объявление '+city,category:'Для дома',price_rub:1500,deal_type:'sell'},{...common,id:'gig-'+city,title:'Задание '+city,category:'Подработка',price_rub:800,deal_type:'gig_offer'}]:table==='community_posts'?[{...common,id:'post-'+city,title:'Новость '+city,body:'Текст опубликованной новости',post_type:'news'}]:(filters.listing_id||[]).map(id=>({listing_id:id,object_path:id+'/photo.webp',slot:0}));return Promise.resolve({data:records,error:null}).then(resolve,reject);}};
 for(const method of ['select','order','limit','in','abortSignal'])query[method]=()=>query;
 query.in=(key,value)=>{filters[key]=value;return query;};
 query.eq=(key,value)=>{filters[key]=value;window.homeRequests??=[];window.homeRequests.push({table,key,value});return query;};
 return query;},storage:{from(){return {async createSignedUrl(){return {data:{signedUrl:'/tests/photo-valid.png'},error:null};}}}}
};}
