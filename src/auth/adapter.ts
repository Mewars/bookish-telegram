// All authentication uses the shared Supabase client. Provider-specific login is not enabled.
// Telegram identity exchange remains a separate future backend operation.
export { readAccountData, updateCurrentProfile } from '../services/profiles';
