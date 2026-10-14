-- PREPARED ONLY. NEVER execute on production before a tested private backup,
-- verified account UUID, organizations.sql and city-admin-mvp.sql.
-- A franchise editor CANNOT create/edit cities. Only the platform owner (role
-- owner, city='*') is authorized, checked by PostgreSQL RLS.
BEGIN;

CREATE TABLE IF NOT EXISTS public.city_directory (
  name text PRIMARY KEY CHECK (length(name) BETWEEN 2 AND 100 AND name = btrim(name) AND position('/' IN name) = 0),
  region text NOT NULL CHECK (length(region) BETWEEN 2 AND 120 AND btrim(region) <> ''),
  tagline text NOT NULL DEFAULT 'Открывай город по-новому' CHECK (length(tagline) BETWEEN 1 AND 160),
  summary text NOT NULL DEFAULT 'Места, события и полезные услуги города в одном месте.' CHECK (length(summary) BETWEEN 1 AND 300),
  cover_url text CHECK (cover_url IS NULL OR (length(cover_url) <= 1000 AND cover_url ~ '^https://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.city_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_directory FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.city_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT (name,region,tagline,summary,cover_url,active) ON public.city_directory TO anon, authenticated;
GRANT INSERT (name,region,tagline,summary,cover_url) ON public.city_directory TO authenticated;
GRANT UPDATE (region,tagline,summary,cover_url,active) ON public.city_directory TO authenticated;

DROP POLICY IF EXISTS city_directory_read_active ON public.city_directory;
CREATE POLICY city_directory_read_active ON public.city_directory FOR SELECT TO anon, authenticated
  USING (active = true);

-- Public readers cannot create cities; authenticated users need an actual
-- owner grant from city_admin_access, independent of app-side button visibility.
DROP POLICY IF EXISTS city_directory_owner_read ON public.city_directory;
CREATE POLICY city_directory_owner_read ON public.city_directory FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.city_admin_access a WHERE
    a.user_id=(SELECT auth.uid()) AND a.active AND a.city='*' AND a.role='owner')
);
DROP POLICY IF EXISTS city_directory_owner_insert ON public.city_directory;
CREATE POLICY city_directory_owner_insert ON public.city_directory FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.city_admin_access a WHERE
    a.user_id=(SELECT auth.uid()) AND a.active AND a.city='*' AND a.role='owner')
);
DROP POLICY IF EXISTS city_directory_owner_update ON public.city_directory;
CREATE POLICY city_directory_owner_update ON public.city_directory FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.city_admin_access a WHERE
    a.user_id=(SELECT auth.uid()) AND a.active AND a.city='*' AND a.role='owner')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.city_admin_access a WHERE
    a.user_id=(SELECT auth.uid()) AND a.active AND a.city='*' AND a.role='owner')
);

-- Seed only the approved two city names, NOT fake places or images.
INSERT INTO public.city_directory(name,region) VALUES
  ('Енисейск','Красноярский край'),
  ('Лесосибирск','Красноярский край')
ON CONFLICT (name) DO NOTHING;

-- Owner-uploaded covers only. No stock images.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('ryadom-city-covers','ryadom-city-covers',true,4194304,ARRAY['image/webp']::text[])
ON CONFLICT(id) DO NOTHING;

DROP POLICY IF EXISTS ryadom_city_covers_owner_insert ON storage.objects;
CREATE POLICY ryadom_city_covers_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='ryadom-city-covers' AND name ~ '^covers/[0-9a-f-]{36}\.webp$'
  AND EXISTS(SELECT 1 FROM public.city_admin_access a WHERE
    a.user_id=(SELECT auth.uid()) AND a.active AND a.city='*' AND a.role='owner')
);
DROP POLICY IF EXISTS ryadom_city_covers_owner_select ON storage.objects;
CREATE POLICY ryadom_city_covers_owner_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='ryadom-city-covers' AND name ~ '^covers/[0-9a-f-]{36}\.webp$'
  AND EXISTS(SELECT 1 FROM public.city_admin_access a WHERE
    a.user_id=(SELECT auth.uid()) AND a.active AND a.city='*' AND a.role='owner')
);
DROP POLICY IF EXISTS ryadom_city_covers_owner_delete ON storage.objects;
CREATE POLICY ryadom_city_covers_owner_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id='ryadom-city-covers' AND name ~ '^covers/[0-9a-f-]{36}\.webp$'
  AND EXISTS(SELECT 1 FROM public.city_admin_access a WHERE
    a.user_id=(SELECT auth.uid()) AND a.active AND a.city='*' AND a.role='owner')
);
COMMIT;
