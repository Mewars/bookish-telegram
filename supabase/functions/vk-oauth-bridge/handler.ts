import { cipher, digest, equalSecret, randomSecret } from './crypto.ts';
import type { BridgeStore, RecordKind } from './store.ts';

export const PROJECT_ORIGIN='https://cptbmepnbzogqkfhflsg.supabase.co';
export const BASE_URL=PROJECT_ORIGIN+'/functions/v1/vk-oauth-bridge';
export const AUTH_CALLBACK=PROJECT_ORIGIN+'/auth/v1/callback';
export const VK_CALLBACK=BASE_URL+'/callback';
const opaque=/^[A-Za-z0-9_-]{43}$/;
const commonHeaders={ 'Cache-Control':'no-store', Pragma:'no-cache', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff' };
export interface BridgeConfig { clientId: string; clientSecret: string; encryptionKey: string; vkAppId: string }
interface Attempt { state: string; challenge: string; verifier: string; cookieHash: string }
export interface Claims { sub: string; name: string; given_name: string; family_name: string; picture?: string }
interface Code { challenge: string; claims: Claims }
class Failure extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
function fail(status=400, code='invalid_request'): never { throw new Failure(status,code); }
function json(value: unknown,status=200,extra: Record<string,string>={}) { return Response.json(value,{status,headers:{...commonHeaders,...extra}}); }
function redirect(url: string,cookie?: string) {
  return new Response(null,{status:302,headers:{...commonHeaders,Location:url,...(cookie?{'Set-Cookie':cookie}:{})}});
}
function unique(params: URLSearchParams,allowed: string[]) {
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length!==1) fail();
}
function parameter(params: URLSearchParams,key: string,max=1024): string {
  const value=params.get(key);
  if (!value || value.length>max || [...value].some(char=>char.charCodeAt(0)<32 || char.charCodeAt(0)===127)) fail();
  return value;
}
async function boundedText(body: ReadableStream<Uint8Array>|null,max: number): Promise<string> {
  if (!body) return '';
  const reader=body.getReader(); const chunks: Uint8Array[]=[]; let size=0;
  try {
    while (true) {
      const {value,done}=await reader.read(); if (done) break;
      size+=value.length; if (size>max) { await reader.cancel(); fail(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size); let offset=0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
  return new TextDecoder().decode(bytes);
}
function object(value: unknown): Record<string,unknown> {
  if (!value || typeof value!=='object' || Array.isArray(value)) fail(502,'upstream_error');
  return value as Record<string,unknown>;
}
function subject(value: unknown): string {
  if (typeof value==='number') {
    if (!Number.isSafeInteger(value) || value<=0) fail(502,'upstream_error');
    return String(value);
  }
  if (typeof value!=='string' || !/^[1-9][0-9]{0,19}$/.test(value)) fail(502,'upstream_error');
  return value;
}
function name(value: unknown): string { return typeof value==='string' ? value.trim().slice(0,160) : ''; }
function claimsFromVk(token: Record<string,unknown>,profile: Record<string,unknown>): Claims {
  const user=object(profile.user);
  const sub=subject(user.user_id);
  if (sub!==subject(token.user_id)) fail(502,'upstream_error');
  const given_name=name(user.first_name),family_name=name(user.last_name);
  const claims: Claims={sub,name:[given_name,family_name].filter(Boolean).join(' '),given_name,family_name};
  // Omit email/phone entirely: VK's email field is not proof of email ownership.
  if (typeof user.avatar==='string' && user.avatar.length<=2048) {
    try { const avatar=new URL(user.avatar); if (avatar.protocol==='https:' && !avatar.username && !avatar.password) claims.picture=avatar.href; } catch { /* No unsafe avatar URL. */ }
  }
  return claims;
}

export async function createBridge(config: BridgeConfig,store: BridgeStore,upstream: typeof fetch=fetch) {
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(config.clientId) || !opaque.test(config.clientSecret) || config.vkAppId!=='54818827') throw new Error('Invalid bridge configuration');
  const crypt=await cipher(config.encryptionKey);
  async function put(kind: RecordKind,handle: string,value: unknown,ttl: number) {
    const key=await digest(handle); await store.put(kind,key,await crypt.seal(value,kind+':'+key),ttl);
  }
  async function read<T>(kind: RecordKind,handle: string,take=false): Promise<T|null> {
    const key=await digest(handle),value=await (take?store.take(kind,key):store.get(kind,key));
    return value===null?null:await crypt.open<T>(value,kind+':'+key);
  }
  async function vk(path: 'auth'|'user_info',params: URLSearchParams): Promise<Record<string,unknown>> {
    // Match the official SDK wire format. Only allowlisted parameters enter query.
    const queryKeys=path==='auth'?['grant_type','redirect_uri','client_id','code_verifier','state','device_id']:['client_id'];
    const bodyKey=path==='auth'?'code':'access_token';
    const query=new URLSearchParams(),body=new URLSearchParams();
    for (const key of queryKeys) query.set(key,parameter(params,key,4096));
    body.set(bodyKey,parameter(params,bodyKey,8192));
    const endpoint=new URL('https://id.vk.ru/oauth2/'+path); endpoint.search=query.toString();
    let response: Response;
    try { response=await upstream(endpoint.href,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:body.toString(),redirect:'error',signal:AbortSignal.timeout(10_000)}); }
    catch { fail(502,'upstream_error'); }
    if (!response.ok) fail(502,'upstream_error');
    let data: unknown;
    try { data=JSON.parse(await boundedText(response.body,32_768)); } catch { fail(502,'upstream_error'); }
    const result=object(data); if (result.error) fail(502,'upstream_error'); return result;
  }
  function cookieName(state: string) { return '__Host-ryadom-vk-'+state; }
  function cookie(state: string,value: string,seconds: number) {
    return cookieName(state)+'='+value+'; Path=/; Max-Age='+seconds+'; Secure; HttpOnly; SameSite=Lax';
  }
  function cookieValue(request: Request,state: string): string {
    const matches=(request.headers.get('Cookie')??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(cookieName(state)+'='));
    if (matches.length!==1) fail(400,'invalid_state');
    const value=matches[0].slice(cookieName(state).length+1); if (!opaque.test(value)) fail(400,'invalid_state'); return value;
  }
  function downstream(state: string,code?: string,error='server_error') {
    const url=new URL(AUTH_CALLBACK); url.searchParams.set('state',state);
    if (code) url.searchParams.set('code',code); else url.searchParams.set('error',error);
    return url.href;
  }
  async function authorize(url: URL) {
    const p=url.searchParams;
    unique(p,['response_type','client_id','redirect_uri','state','code_challenge','code_challenge_method','scope']);
    if (parameter(p,'response_type')!=='code' || parameter(p,'client_id')!==config.clientId || parameter(p,'redirect_uri')!==AUTH_CALLBACK || parameter(p,'code_challenge_method')!=='S256') fail();
    const challenge=parameter(p,'code_challenge',43); if (!opaque.test(challenge)) fail();
    const state=parameter(p,'state',8192);
    if (p.has('scope') && !['','profile'].includes(p.get('scope')!)) fail(400,'invalid_scope');
    const vkState=randomSecret(),verifier=randomSecret(),binding=randomSecret();
    await put('attempt',vkState,{state,challenge,verifier,cookieHash:await digest(binding)} satisfies Attempt,600);
    const target=new URL('https://id.vk.ru/authorize');
    target.search=new URLSearchParams({client_id:config.vkAppId,redirect_uri:VK_CALLBACK,response_type:'code',state:vkState,code_challenge:await digest(verifier),code_challenge_method:'s256',scope:'vkid.personal_info'}).toString();
    return redirect(target.href,cookie(vkState,binding,600));
  }
  async function callback(request: Request,url: URL) {
    const p=url.searchParams;
    // VK may return auxiliary parameters (type, expires_in); never trust/render them.
    for (const key of p.keys()) if (p.getAll(key).length!==1) fail();
    const state=parameter(p,'state',43); if (!opaque.test(state)) fail(400,'invalid_state');
    const pending=await read<Attempt>('attempt',state); if (!pending) fail(400,'invalid_state');
    if (!await equalSecret(await digest(cookieValue(request,state)),pending.cookieHash)) fail(400,'invalid_state');
    const attempt=await read<Attempt>('attempt',state,true); if (!attempt) fail(400,'invalid_state');
    const clear=cookie(state,'',0);
    try {
      if (p.has('error')) return redirect(downstream(attempt.state,undefined,p.get('error')==='access_denied'?'access_denied':'server_error'),clear);
      const code=parameter(p,'code',4096),device=parameter(p,'device_id',512);
      const params=new URLSearchParams({grant_type:'authorization_code',client_id:config.vkAppId,redirect_uri:VK_CALLBACK,code,device_id:device,code_verifier:attempt.verifier,state});
      const token=await vk('auth',params);
      if (typeof token.access_token!=='string' || !token.access_token || token.access_token.length>8192 || typeof token.token_type!=='string' || token.token_type.toLowerCase()!=='bearer' || typeof token.expires_in!=='number' || token.expires_in<=0 || token.state!==state) fail(502,'upstream_error');
      const profile=await vk('user_info',new URLSearchParams({client_id:config.vkAppId,access_token:token.access_token}));
      const claims=claimsFromVk(token,profile),bridgeCode=randomSecret();
      await put('code',bridgeCode,{challenge:attempt.challenge,claims} satisfies Code,120);
      // Upstream access/refresh tokens are neither persisted nor returned.
      return redirect(downstream(attempt.state,bridgeCode),clear);
    } catch { return redirect(downstream(attempt.state),clear); }
  }
  async function authenticate(request: Request,p: URLSearchParams) {
    let id: string|undefined,secret: string|undefined;
    const header=request.headers.get('Authorization');
    if (header) {
      if (header.length>2048 || !/^Basic [A-Za-z0-9+/]+={0,2}$/i.test(header) || p.has('client_secret')) fail(401,'invalid_client');
      try {
        const decoded=atob(header.slice(6)),separator=decoded.indexOf(':');
        if (separator<0) fail(401,'invalid_client');
        id=decodeURIComponent(decoded.slice(0,separator)); secret=decodeURIComponent(decoded.slice(separator+1));
      } catch { fail(401,'invalid_client'); }
      if (p.has('client_id') && p.get('client_id')!==id) fail(401,'invalid_client');
    } else { id=p.get('client_id')??undefined; secret=p.get('client_secret')??undefined; }
    if (id!==config.clientId || !secret || !await equalSecret(secret,config.clientSecret)) fail(401,'invalid_client');
  }
  async function token(request: Request,url: URL) {
    if (url.search) fail();
    if (request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/x-www-form-urlencoded') fail(415);
    const p=new URLSearchParams(await boundedText(request.body,8192));
    unique(p,['client_id','client_secret','grant_type','code','redirect_uri','code_verifier']);
    await authenticate(request,p);
    if (parameter(p,'grant_type')!=='authorization_code') fail(400,'unsupported_grant_type');
    if (parameter(p,'redirect_uri')!==AUTH_CALLBACK) fail(400,'invalid_grant');
    const code=parameter(p,'code',43),verifier=parameter(p,'code_verifier',128);
    if (!opaque.test(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) fail(400,'invalid_grant');
    const record=await read<Code>('code',code);
    if (!record || !await equalSecret(await digest(verifier),record.challenge)) fail(400,'invalid_grant');
    const redeemed=await read<Code>('code',code,true); if (!redeemed) fail(400,'invalid_grant');
    const bearer=randomSecret(); await put('bearer',bearer,redeemed.claims,60);
    return json({access_token:bearer,token_type:'Bearer',expires_in:60,scope:'profile'});
  }
  async function userinfo(request: Request,url: URL) {
    if (url.search) fail();
    const header=request.headers.get('Authorization')??'';
    if (!/^Bearer [A-Za-z0-9_-]{43}$/i.test(header)) fail(401,'invalid_token');
    const claims=await read<Claims>('bearer',header.slice(7),true);
    if (!claims) fail(401,'invalid_token');
    // One-use token is already invalid if Supabase includes provider_token in its session.
    return json(claims);
  }
  return async (request: Request): Promise<Response> => {
    try {
      const url=new URL(request.url);
      // Edge gateways may rewrite request.url to an internal origin and strip
      // /functions/v1/ or the function slug. The gateway owns function routing.
      // Match only these four exact paths; all OAuth redirect origins stay pinned.
      const routes=['/authorize','/callback','/token','/userinfo'] as const;
      const prefixes=[new URL(BASE_URL).pathname,'/vk-oauth-bridge',''];
      const route=routes.find(path=>prefixes.some(prefix=>url.pathname===prefix+path));
      if (!route) fail(404,'not_found');
      const method=route==='/token'?'POST':'GET';
      if (!['/authorize','/callback','/token','/userinfo'].includes(route)) fail(404,'not_found');
      if (request.method!==method) return json({error:'invalid_request'},405,{Allow:method});
      if (!await store.limit(route==='/authorize'?'authorize':'exchange')) return json({error:'temporarily_unavailable'},429,{'Retry-After':'60'});
      if (route==='/authorize') return await authorize(url);
      if (route==='/callback') return await callback(request,url);
      if (route==='/token') return await token(request,url);
      return await userinfo(request,url);
    } catch (error) {
      if (error instanceof Failure) return json({error:error.code},error.status,error.status===401?{'WWW-Authenticate':error.code==='invalid_token'?'Bearer realm="vk-bridge"':'Basic realm="vk-bridge"'}:{});
      // Never log request objects, tokens, body or upstream/database error messages.
      return json({error:'temporarily_unavailable'},503);
    }
  };
}
