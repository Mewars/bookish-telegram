// A project ID substring is not sufficient to identify a trusted Supabase origin.
// Explicitly reject lookalike domains, userinfo, query strings and URL path tricks.
export const RYADOM_TEST_SUPABASE_ORIGIN = 'https://djqhixvlfsbvannoqdjw.supabase.co';

export function isRyadomTestBackend(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.origin === RYADOM_TEST_SUPABASE_ORIGIN &&
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname === '/' &&
      url.search === '' &&
      url.hash === '';
  } catch {
    return false;
  }
}
