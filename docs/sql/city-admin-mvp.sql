-- «Рядом»: первый защищённый кабинет администратора организаций.
-- Apply ONLY after reviewing and executing organizations.sql, then organizations-seed.sql.
-- This file is NOT run by GitHub Actions or site builds.
-- DO NOT paste a service_role or Supabase Secret key into the site or this file.
BEGIN;

-- Grant access ONLY via trusted SQL Editor/service-role process.
-- The owner has access to all future cities using the special scope '*'.
CREATE TABLE IF NOT EXISTS public.city_admin_access (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city text NOT NULL CHECK (length(city) BETWEEN 1 AND 100),
  role text NOT NULL CHECK (role IN ('owner', 'editor')),
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

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS image_url text;
-- Supports both the public Places and Services sections. Existing rows remain Places.
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'places'
  CHECK (kind IN ('places', 'services'));
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_image_url_safe' AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_image_url_safe
      CHECK (image_url IS NULL OR (length(image_url) <= 1000 AND image_url ~ '^https://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$'));
  END IF;
END $$;

-- Ownership is validated by RLS, not by a hidden browser button.
-- Scope to selected city; a '*' owner can administer any city.
GRANT INSERT (id, city, kind, title, category, description, address, phone, hours,
  website, vk_url, source_type, source_url, verified_at, status, image_url)
  ON public.organizations TO authenticated;
GRANT UPDATE (title, category, description, address, phone, hours,
  website, vk_url, source_type, source_url, verified_at, status, image_url)
  ON public.organizations TO authenticated;

DROP POLICY IF EXISTS organizations_admin_read ON public.organizations;
CREATE POLICY organizations_admin_read ON public.organizations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.city_admin_access access
      WHERE access.user_id = (SELECT auth.uid()) AND access.active
        AND (access.city = organizations.city OR (access.city = '*' AND access.role = 'owner')))
  );

DROP POLICY IF EXISTS organizations_admin_insert ON public.organizations;
CREATE POLICY organizations_admin_insert ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.city_admin_access access
      WHERE access.user_id = (SELECT auth.uid()) AND access.active
        AND (access.city = organizations.city OR (access.city = '*' AND access.role = 'owner')))
  );

DROP POLICY IF EXISTS organizations_admin_update ON public.organizations;
CREATE POLICY organizations_admin_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.city_admin_access access
      WHERE access.user_id = (SELECT auth.uid()) AND access.active
        AND (access.city = organizations.city OR (access.city = '*' AND access.role = 'owner')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.city_admin_access access
      WHERE access.user_id = (SELECT auth.uid()) AND access.active
        AND (access.city = organizations.city OR (access.city = '*' AND access.role = 'owner')))
  );

-- Public organization photos are intentionally public; only authorized city admins upload them.
-- No SVG or other active file types. Uploads are maximum 2 MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ryadom-places', 'ryadom-places', true, 2097152,
  ARRAY['image/jpeg','image/png','image/webp']::text[])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS ryadom_places_admin_upload ON storage.objects;
CREATE POLICY ryadom_places_admin_upload ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'ryadom-places'
    AND EXISTS (SELECT 1 FROM public.city_admin_access access
      WHERE access.user_id = (SELECT auth.uid()) AND access.active
        AND ((storage.foldername(name))[1] = access.city
          OR (access.city = '*' AND access.role = 'owner')))
  );

-- Previously closed establishments must never be republished by an old seed.
UPDATE public.organizations SET status = 'archived'
WHERE id IN ('place-blinnaya-izba','place-pritchi') AND status <> 'archived';

COMMIT;

-- AFTER validating the owner's CURRENT auth user UUID privately in Supabase:
-- INSERT INTO public.city_admin_access (user_id, city, role)
-- VALUES ('YOUR-REAL-AUTH-USER-UUID', '*', 'owner')
-- ON CONFLICT (user_id, city) DO UPDATE SET role = EXCLUDED.role, active = true;
-- Do NOT guess a user UUID or assign access by email/display name.
