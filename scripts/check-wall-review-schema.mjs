import process from 'node:process';
const {fetch,URL,AbortSignal,console}=globalThis;
// Only a release that includes /wall/ needs this additive backend migration.
// Use an anonymous request: the private reason table must exist AND deny access.
const url=process.env.VITE_SUPABASE_URL;
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw Error('Missing public Supabase configuration');
const response=await fetch(new URL('/rest/v1/community_post_review_reasons?select=post_id&limit=0',url),{
 headers:{apikey:key},signal:AbortSignal.timeout(15000)
});
const data=await response.json();
if(![401,403].includes(response.status)||data.code!=='42501')
 throw Error('Wall review migration is missing or anonymous access is not blocked. Apply the reviewed SQL before publishing this release.');
console.log('Private wall-review schema is present; anonymous access is blocked.');
