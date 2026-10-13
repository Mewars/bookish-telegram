import { createBridge, PROJECT_ORIGIN } from './handler.ts';
import { postgresStore } from './store.ts';
declare const Deno: { env: { get(name: string): string|undefined }; serve(handler: (request: Request) => Promise<Response>): void };
let handler: ReturnType<typeof createBridge>|undefined;
Deno.serve(async request => {
  if (Deno.env.get('VK_BRIDGE_ENABLED')!=='true') return Response.json({error:'temporarily_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  try {
    handler??=createBridge({
      clientId:Deno.env.get('VK_BRIDGE_CLIENT_ID')??'',clientSecret:Deno.env.get('VK_BRIDGE_CLIENT_SECRET')??'',
      encryptionKey:Deno.env.get('VK_BRIDGE_ENCRYPTION_KEY')??'',vkAppId:Deno.env.get('VK_APP_ID')??'',vkSecret:Deno.env.get('VK_APP_SECRET'),
    },postgresStore(PROJECT_ORIGIN,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??''));
    return await (await handler)(request);
  } catch { handler=undefined; return Response.json({error:'temporarily_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}}); }
});
