import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../config/supabase';
const config = getSupabaseConfig();
export const supabase = config ? createClient(config.url, config.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;
if (!supabase && import.meta.env.DEV) {
  console.warn('Supabase не настроен: укажите VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY. Доступен гостевой режим.');
}
