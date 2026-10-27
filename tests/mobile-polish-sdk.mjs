/* global document */
export const client={
 auth:{async getUser(){return {data:{user:{id:document.getElementById('test-actor').value}},error:null};}},
 from(){let id='';const q={select(){return q;},eq(k,v){if(k==='user_id')id=v;return q;},abortSignal(){return q;},then(resolve,reject){return Promise.resolve({data:id==='owner'?[{user_id:id,city:'*',role:'owner',active:true}]:id==='editor'?[{user_id:id,city:'Город А',role:'editor',active:true}]:[],error:null}).then(resolve,reject);}};return q;}
};
