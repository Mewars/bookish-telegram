// Local-only protocol fixture. Never deploy; no real Supabase/VK requests or sessions.
import { createServer } from 'node:http';
import process from 'node:process';
import { URL } from 'node:url';
const { Request, Response } = globalThis;
import { createBridge } from '../supabase/functions/vk-oauth-bridge/handler.ts';
import { randomSecret } from '../supabase/functions/vk-oauth-bridge/crypto.ts';
const config={clientId:'browser-fixture',clientSecret:randomSecret(),encryptionKey:randomSecret(),vkAppId:'54818827'};
const rows=new Map();
const store={
  put:async(kind,key,payload,ttl)=>{rows.set(kind+key,{payload,expiry:Date.now()+ttl*1000});},
  get:async(kind,key)=>{const row=rows.get(kind+key);return row && row.expiry>Date.now()?row.payload:null;},
  take:async(kind,key)=>{const row=rows.get(kind+key);if(!row || row.expiry<=Date.now())return null;rows.delete(kind+key);return row.payload;},
  limit:async()=>true,
};
const upstream=async(url)=>{const endpoint=new URL(url);return Response.json(endpoint.pathname.endsWith('/auth')?{access_token:'not-a-real-vk-token',user_id:42,token_type:'Bearer',expires_in:3600,state:endpoint.searchParams.get('state')}:{user:{user_id:'42',first_name:'Verified Browser'}});};
const handler=await createBridge(config,store,upstream);
const server=createServer(async(request,response)=>{
  if(request.url!=='/relay' || request.method!=='POST') {response.writeHead(404);response.end();return;}
  let raw='';for await(const chunk of request) raw+=chunk;
  try {
    const {url,method,headers,body}=JSON.parse(raw);
    const result=await handler(new Request(url,{method,headers,...(body?{body}:{})}));
    response.setHeader('Content-Type','application/json');
    response.end(JSON.stringify({status:result.status,headers:Object.fromEntries(result.headers),body:await result.text()}));
  } catch {response.writeHead(500);response.end('Fixture error');}
});
server.listen(0,'127.0.0.1',()=>{process.stdout.write(JSON.stringify({port:server.address().port,clientId:config.clientId})+'\n');});
