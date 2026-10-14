-- Private Ryadom photo editor. ISOLATED ADDITIVE MIGRATION, NOT YET EXECUTED.
-- Before running in production: owner backups and explicit real Auth UUID verification.
BEGIN;

CREATE TABLE IF NOT EXISTS public.city_admin_access (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city text NOT NULL CHECK (length(city) BETWEEN 1 AND 100),
  role text NOT NULL CHECK (role IN ('owner','editor')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, city),
  CHECK (city <> '*' OR role = 'owner')
);
ALTER TABLE public.city_admin_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_admin_access FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.city_admin_access FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id,city,role,active,created_at) ON public.city_admin_access TO authenticated;
DROP POLICY IF EXISTS city_admin_access_read_self ON public.city_admin_access;
CREATE POLICY city_admin_access_read_self ON public.city_admin_access
 FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- No dependency on the full organizations CMS or any Auth/Profile modification.
CREATE TABLE IF NOT EXISTS public.directory_card_photos (
  card_id text PRIMARY KEY CHECK (card_id ~ '^(place|service)-[a-z0-9-]{1,100}$'),
  city text NOT NULL DEFAULT 'Енисейск' CHECK (city = 'Енисейск'),
  storage_path text NOT NULL CHECK (
    storage_path ~ '^eniseysk/(place|service)-[a-z0-9-]{1,100}/[0-9a-f-]{36}\.webp$'
    AND split_part(storage_path, '/', 2) = card_id
  ),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE public.directory_card_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_card_photos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.directory_card_photos FROM PUBLIC, anon, authenticated;
GRANT SELECT (card_id,city,storage_path,updated_at) ON public.directory_card_photos TO anon, authenticated;
GRANT INSERT (card_id,city,storage_path) ON public.directory_card_photos TO authenticated;
GRANT UPDATE (storage_path) ON public.directory_card_photos TO authenticated;
GRANT DELETE ON public.directory_card_photos TO authenticated;
CREATE INDEX IF NOT EXISTS directory_card_photos_city ON public.directory_card_photos(city);

DROP POLICY IF EXISTS directory_photos_read ON public.directory_card_photos;
CREATE POLICY directory_photos_read ON public.directory_card_photos
 FOR SELECT TO anon, authenticated USING (true);

-- Every write is limited by server-side city administration RLS.
DROP POLICY IF EXISTS directory_photos_admin_insert ON public.directory_card_photos;
CREATE POLICY directory_photos_admin_insert ON public.directory_card_photos
 FOR INSERT TO authenticated WITH CHECK (
   EXISTS (SELECT 1 FROM public.city_admin_access a
     WHERE a.user_id=(SELECT auth.uid()) AND a.active
     AND (a.city=directory_card_photos.city OR (a.city='*' AND a.role='owner')))
 );
DROP POLICY IF EXISTS directory_photos_admin_update ON public.directory_card_photos;
CREATE POLICY directory_photos_admin_update ON public.directory_card_photos
 FOR UPDATE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.city_admin_access a
     WHERE a.user_id=(SELECT auth.uid()) AND a.active
     AND (a.city=directory_card_photos.city OR (a.city='*' AND a.role='owner'))))
 WITH CHECK (EXISTS (SELECT 1 FROM public.city_admin_access a
     WHERE a.user_id=(SELECT auth.uid()) AND a.active
     AND (a.city=directory_card_photos.city OR (a.city='*' AND a.role='owner'))));
DROP POLICY IF EXISTS directory_photos_admin_delete ON public.directory_card_photos;
CREATE POLICY directory_photos_admin_delete ON public.directory_card_photos
 FOR DELETE TO authenticated USING (
   EXISTS (SELECT 1 FROM public.city_admin_access a
     WHERE a.user_id=(SELECT auth.uid()) AND a.active
     AND (a.city=directory_card_photos.city OR (a.city='*' AND a.role='owner')))
 );

-- Public photo viewing; only designated admins may INSERT/SELECT/DELETE Storage objects.
-- Browser produces image/webp after stripping EXIF; bucket enforces <=4MiB.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('ryadom-card-photos','ryadom-card-photos',true,4194304,ARRAY['image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS ryadom_card_photos_admin_upload ON storage.objects;
CREATE POLICY ryadom_card_photos_admin_upload ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
   bucket_id='ryadom-card-photos'
   AND name ~ '^eniseysk/(place|service)-[a-z0-9-]{1,100}/[0-9a-f-]{36}\.webp$'
   AND EXISTS (SELECT 1 FROM public.city_admin_access a
     WHERE a.user_id=(SELECT auth.uid()) AND a.active
     AND (a.city='Енисейск' OR (a.city='*' AND a.role='owner')))
 );
DROP POLICY IF EXISTS ryadom_card_photos_admin_select ON storage.objects;
CREATE POLICY ryadom_card_photos_admin_select ON storage.objects
 FOR SELECT TO authenticated USING (
   bucket_id='ryadom-card-photos'
   AND name ~ '^eniseysk/(place|service)-[a-z0-9-]{1,100}/[0-9a-f-]{36}\.webp$'
   AND EXISTS (SELECT 1 FROM public.city_admin_access a
     WHERE a.user_id=(SELECT auth.uid()) AND a.active
     AND (a.city='Енисейск' OR (a.city='*' AND a.role='owner')))
 );
DROP POLICY IF EXISTS ryadom_card_photos_admin_remove ON storage.objects;
CREATE POLICY ryadom_card_photos_admin_remove ON storage.objects
 FOR DELETE TO authenticated USING (
   bucket_id='ryadom-card-photos'
   AND name ~ '^eniseysk/(place|service)-[a-z0-9-]{1,100}/[0-9a-f-]{36}\.webp$'
   AND EXISTS (SELECT 1 FROM public.city_admin_access a
     WHERE a.user_id=(SELECT auth.uid()) AND a.active
     AND (a.city='Енисейск' OR (a.city='*' AND a.role='owner')))
 );
COMMIT;

-- AFTER verifying the owner's real auth.users UUID, separately:
-- INSERT INTO public.city_admin_access(user_id,city,role)
-- VALUES ('VERIFIED-UUID','*','owner')
-- ON CONFLICT (user_id,city) DO UPDATE SET role='owner',active=true;
