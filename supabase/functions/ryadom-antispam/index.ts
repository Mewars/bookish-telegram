import {createAntiSpamHandler} from './handler.ts';
Deno.serve(createAntiSpamHandler({
 SUPABASE_URL:Deno.env.get('SUPABASE_URL')||'',
 SUPABASE_ANON_KEY:Deno.env.get('SUPABASE_ANON_KEY')||'',
 SUPABASE_SERVICE_ROLE_KEY:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',
 TURNSTILE_SECRET_KEY:Deno.env.get('TURNSTILE_SECRET_KEY')||'',
 TURNSTILE_ALLOWED_HOSTNAMES:Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES')||'ryadomcity.ru,www.ryadomcity.ru',
}));
