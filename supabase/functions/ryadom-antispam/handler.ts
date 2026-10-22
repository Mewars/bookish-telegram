type Environment={SUPABASE_URL:string;SUPABASE_ANON_KEY:string;SUPABASE_SERVICE_ROLE_KEY:string;TURNSTILE_SECRET_KEY:string;TURNSTILE_ALLOWED_HOSTNAMES:string};
const ACTIONS=new Set(['classified','wall_post','wall_comment','organization']);
export function createAntiSpamHandler(env:Environment,request:typeof fetch=fetch){
 const hosts=env.TURNSTILE_ALLOWED_HOSTNAMES.split(',').map(s=>s.trim()).filter(Boolean);
 return async(req:Request):Promise<Response>=>{
  const origin=req.headers.get('origin')||'';
  let allowed=false;try{const u=new URL(origin);allowed=u.protocol==='https:'&&hosts.includes(u.hostname)&&u.port==='';}catch{/* not a browser origin */}
  const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(allowed){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization,apikey,content-type,x-client-info';headers['Access-Control-Allow-Methods']='POST,OPTIONS';}
  const response=(status:number,error:string)=>new Response(JSON.stringify({error}),{status,headers});
  if(!allowed)return response(403,'Origin not allowed');
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return response(405,'Method not allowed');
  if(!env.TURNSTILE_SECRET_KEY||/^[123]x0/.test(env.TURNSTILE_SECRET_KEY)||!env.SUPABASE_SERVICE_ROLE_KEY)return response(503,'Verification unavailable');
  const authorization=req.headers.get('authorization')||'';
  if(!/^Bearer \S+$/i.test(authorization))return response(401,'Authentication required');
  try{
   const reader=req.body?.getReader();if(!reader)return response(400,'Body required');
   let bytes=0,text='';const decoder=new TextDecoder();
   for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>8192){await reader.cancel();return response(413,'Request too large');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
   let body;try{body=JSON.parse(text);}catch{return response(400,'Invalid request');}
   if(!body||typeof body.token!=='string'||body.token.length<1||body.token.length>2048||!ACTIONS.has(body.action)||body.resource_id!=null&&(typeof body.resource_id!=='string'||body.resource_id.length>160))return response(400,'Invalid request');
   const auth=await request(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:authorization},signal:AbortSignal.timeout(8000)});
   if(!auth.ok)return response(401,'Authentication required');
   const user=await auth.json();if(typeof user.id!=='string')return response(401,'Authentication required');
   const rpc=async(name:string,args:object)=>request(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
   const configuration=await rpc('antispam_public_config',{});
   if(!configuration.ok||(await configuration.json())?.content_enabled!==true)return response(503,'Verification unavailable');
   const verified=await request('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:body.token}),signal:AbortSignal.timeout(8000)});
   if(!verified.ok)return response(503,'Verification unavailable');
   const result=await verified.json();
   if(result.success!==true||!hosts.includes(result.hostname)||result.action!==body.action)return response(403,'Verification failed');
   const granted=await rpc('antispam_grant',{p_user_id:user.id,p_action:body.action,p_resource_id:body.resource_id??null});
   if(!granted.ok)return response(429,'Unable to grant verification');
   return new Response(JSON.stringify({verified:true}),{status:200,headers});
  }catch{return response(503,'Verification unavailable');}
 };
}
