// Synthetic SDK, only loaded by the isolated browser fixture. Never contacts Supabase.
const calls=[];let saved;
export function c(){return {
 auth:{getUser:async()=>({data:{user:{id:'business-test-user'}},error:null})},
 rpc:async()=>({data:{auth_enabled:false,content_enabled:false},error:null}),
 from(table){let payload;const b={};
  for(const method of ['select','eq','order','range','abortSignal','single'])b[method]=()=>b;
  b.insert=value=>{payload=value;calls.push({table,value});return b;};
  b.then=(resolve,reject)=>{if(payload)saved={...payload,id:'synthetic-request',status:'pending',created_at:'2026-10-25T00:00:00Z'};
   return Promise.resolve({data:payload?saved:saved?[saved]:[],error:null}).then(resolve,reject);};return b;
 }
};}
export function submissions(){return calls;}
