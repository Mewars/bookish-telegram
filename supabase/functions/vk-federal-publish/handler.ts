/** Federal VK wall publishing, deliberately disabled without a server-owned token.
 * This handler never accepts target group, credentials, account ID or moderation
 * role from the browser. It requires a verified Ryadom session and network-
 * verified global owner access. Only original, manually approved owner text.
 */
export const FEDERAL_GROUP_ID=242202919;
export const FEDERAL_WALL_ID=-242202919;
export const VK_API_VERSION='5.199';
const ORIGIN='https://ryadomcity.ru';
type Config={enabled:boolean;vkToken:string;supabaseUrl:string;supabaseKey:string};
type Fetcher=typeof fetch;
function reply(code:number,data:Record<string,unknown>,origin?:string){
  return Response.json(data,{status:code,headers:{
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'Vary':'Origin',
    ...(origin?{'Access-Control-Allow-Origin':origin}:{}),
  }});
}
function object(v:unknown):v is Record<string,unknown>{return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function uuid(v:unknown):v is string{return typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);}
function authHeader(request:Request):string|null{
  const h=request.headers.get('authorization');
  return h&&/^Bearer [a-zA-Z0-9._~-]{30,12000}$/.test(h)?h:null;
}
export function createFederalPublisher(config:Config,upstream:Fetcher=fetch){
 return async function handle(request:Request):Promise<Response>{
   const origin=request.headers.get('origin');
   // Reject unknown browser origins. No wildcard CORS or cross-site credentials.
   if(origin!==null&&origin!==ORIGIN)return reply(403,{error:'origin_forbidden'});
   const allowed=origin===ORIGIN?ORIGIN:undefined;
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
     'Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':allowed??'null',
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'authorization, apikey, content-type',
     'Access-Control-Max-Age':'600',
   }});
   if(request.method!=='POST')return reply(405,{error:'method_not_allowed'},allowed);
   if(!config.enabled||config.vkToken.length<20||!/^https:\/\//.test(config.supabaseUrl)||!config.supabaseKey)
      return reply(503,{error:'publishing_not_configured'},allowed);
   const auth=authHeader(request);
   if(!auth)return reply(401,{error:'authentication_required'},allowed);
   if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
     return reply(415,{error:'json_required'},allowed);
   const raw=await request.text();
   if(raw.length>12000)return reply(413,{error:'payload_too_large'},allowed);
   let value:unknown;
   try{value=JSON.parse(raw);}catch{return reply(400,{error:'invalid_json'},allowed);}
   if(!object(value)||Object.keys(value).some(k=>!['message','requestId'].includes(k))||
      typeof value.message!=='string'||!uuid(value.requestId))
     return reply(400,{error:'invalid_payload'},allowed);
   const message=value.message.trim();
   if(message.length<20||message.length>2500||Array.from(message).some(ch=>{const n=ch.charCodeAt(0);return n<32&&n!==9&&n!==10&&n!==13;}))
     return reply(400,{error:'invalid_message'},allowed);
   const common={
      'Authorization':auth,
      'apikey':config.supabaseKey,
      'Accept':'application/json'
   };
   // Authenticate against the real Auth server, never trust client-supplied roles.
   let userId:string;
   try{
     const u=await upstream(new URL('/auth/v1/user',config.supabaseUrl).toString(),{
       method:'GET',headers:common,redirect:'error',signal:AbortSignal.timeout(8000)
     });
     if(!u.ok)return reply(401,{error:'invalid_session'},allowed);
     const user=await u.json() as unknown;
     if(!object(user)||!uuid(user.id))return reply(401,{error:'invalid_session'},allowed);
     userId=user.id;
   }catch{return reply(502,{error:'authentication_unavailable'},allowed);}
   // Exact global platform-owner role only; city editors cannot publish federal news.
   try{
     const q=new URL('/rest/v1/city_admin_access',config.supabaseUrl);
     q.searchParams.set('select','user_id,city,role,active');
     q.searchParams.set('user_id','eq.'+userId);
     q.searchParams.set('active','eq.true');
     const access=await upstream(q.toString(),{method:'GET',headers:common,redirect:'error',signal:AbortSignal.timeout(8000)});
     if(!access.ok)return reply(403,{error:'not_authorized'},allowed);
     const rows=await access.json() as unknown;
     if(!Array.isArray(rows)||!rows.some(row=>object(row)&&row.user_id===userId&&row.city==='*'&&row.role==='owner'&&row.active===true))
       return reply(403,{error:'not_authorized'},allowed);
   }catch{return reply(502,{error:'authorization_unavailable'},allowed);}
   const form=new URLSearchParams({
     owner_id:String(FEDERAL_WALL_ID),from_group:'1',message,
     guid:value.requestId,v:VK_API_VERSION,access_token:config.vkToken,
   });
   let vk:unknown;
   try{
      const response=await upstream('https://api.vk.com/method/wall.post',{
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},
        body:form.toString(),redirect:'error',signal:AbortSignal.timeout(12000)
      });
      if(!response.ok)return reply(502,{error:'vk_publishing_failed'},allowed);
      vk=await response.json();
   }catch{
      // Unknown outcome; do not auto-retry. Client must retain requestId/guid.
      return reply(502,{error:'vk_result_unknown',retryWithSameRequestId:true},allowed);
   }
   if(!object(vk)||!object(vk.response)||!Number.isSafeInteger(vk.response.post_id)||Number(vk.response.post_id)<=0){
     return reply(502,{error:'vk_publishing_failed'},allowed);
   }
   const postId=vk.response.post_id as number;
   return reply(200,{ok:true,postId,postUrl:`https://vk.ru/wall${FEDERAL_WALL_ID}_${postId}`},allowed);
 };
}
