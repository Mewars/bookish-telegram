-- Security hardening already applied and verified separately in:
-- Ryadom-Test (djqhixvlfsbvannoqdjw) and production (cptbmepnbzogqkfhflsg).
-- The function is used by an internal PostgreSQL DDL event trigger.
-- Revoking browser-role EXECUTE does NOT remove or disable the event trigger.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Verification:
-- SELECT has_function_privilege('anon','public.rls_auto_enable()','EXECUTE');
-- SELECT has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE');
-- Both must return false. The event trigger ensure_rls must remain enabled.
