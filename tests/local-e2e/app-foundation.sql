-- Match the request JWT helpers supplied by hosted Supabase after GoTrue migrations.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
 current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
 current_setting('request.jwt.claims',true)::jsonb->>'role')
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT current_setting('request.jwt.claims',true)::jsonb
$$;
-- Minimal pre-existing city access dependency. This fixture does not implement
-- the catalog admin module; staff assignments are made by test setup only.
CREATE TABLE public.city_admin_access (
 user_id uuid REFERENCES auth.users(id),city text,role text,
 active boolean NOT NULL DEFAULT true,PRIMARY KEY(user_id,city)
);
ALTER TABLE public.city_admin_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_admin_access FORCE ROW LEVEL SECURITY;
GRANT SELECT ON public.city_admin_access TO authenticated;
CREATE POLICY local_city_access_self ON public.city_admin_access FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
GRANT SELECT ON storage.buckets,storage.objects TO anon,authenticated;
GRANT INSERT,DELETE ON storage.objects TO authenticated;
