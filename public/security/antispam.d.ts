import type {SupabaseClient} from '@supabase/supabase-js';
export function antiSpamConfig(client:SupabaseClient):Promise<{auth_enabled:boolean;content_enabled:boolean;site_key:string|null}>;
export function verifyHuman(client:SupabaseClient,action:'auth'|'classified'|'wall_post'|'wall_comment'|'organization',resourceId?:string|null):Promise<string|undefined>;
