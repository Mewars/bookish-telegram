/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VK_ID_ENABLED?: string;
  readonly VITE_ORGANIZATIONS_ENABLED?: string;
  readonly VITE_YANDEX_MAPS_API_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
