import type { SupabaseClient } from '@supabase/supabase-js';
import type { NearbyClient } from './repository';

// Only the verified user token goes to the same-origin API. GPS never goes to Auth.
export function createHostNearbyClient(client:SupabaseClient|null,url:string,request:typeof fetch=fetch):NearbyClient|null {
  if(!client)return null;
  return {rpc:async(name,params={})=>{
    const session=await client.auth.getSession();
    const token=session.data.session?.access_token;
    if(!token)return {data:null,error:{code:'unauthorized'}};
    try {
      const response=await request(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({name,params:name==='nearby_start_sharing'?{...params,p_consent_version:'FRIENDS-GEO-1.0'}:params}),
        credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
      const body=await response.json() as {data:unknown;error:{code?:string}|null};
      if(!response.ok)return {data:null,error:body.error??{code:'unavailable'}};
      if(!body||!Object.hasOwn(body,'data')||body.error)return {data:null,error:{code:'unavailable'}};
      return body;
    }catch {return {data:null,error:{code:'unavailable'}};}
  }};
}
