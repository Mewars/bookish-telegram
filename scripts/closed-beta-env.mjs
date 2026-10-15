// Closed beta packaging has a fail-closed backend/feature allowlist.
// All checks are on PUBLIC browser configuration; never use a service-role key.
const TEST_BACKEND = 'https://djqhixvlfsbvannoqdjw.supabase.co';

export function validateClosedBetaEnvironment(env) {
  if (env.CONTEXT !== 'closed-beta') throw new Error('Closed beta build requires CONTEXT=closed-beta');
  if (env.VITE_SUPABASE_URL !== TEST_BACKEND) throw new Error('Closed beta must use the exact Ryadom-Test Supabase URL');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (!/^sb_publishable_[a-zA-Z0-9_-]{16,}$/.test(key)) {
    throw new Error('Closed beta requires a test-project sb_publishable_ key, not a secret or legacy JWT');
  }
  const required = {
    VITE_CLASSIFIEDS_ENABLED: 'true',
    VITE_COMMUNITY_ENABLED: 'true',
    VITE_BETA_EMAIL_ONLY: 'true',
    VITE_VK_ID_ENABLED: 'false',
    VITE_ADMIN_PANEL_ENABLED: 'false',
    VITE_CARD_PHOTOS_ENABLED: 'false',
    VITE_CITY_DIRECTORY_ENABLED: 'false',
    VITE_ORGANIZATIONS_ENABLED: 'false',
  };
  for (const [name, expected] of Object.entries(required)) {
    if (env[name] !== expected) throw new Error(`Unsafe closed beta configuration: ${name} must be ${expected}`);
  }
  return true;
}
