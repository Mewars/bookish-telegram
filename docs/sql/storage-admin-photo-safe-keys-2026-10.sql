-- Repair Supabase Storage InvalidKey 400 when organization city names use Cyrillic.
-- All new object keys are ASCII-only: city-<UTF8 hex of exact city name>/<uuid>.webp|jpg
-- This is a reversible namespace encoding, not transliteration, so there are no
-- collisions between differently spelled cities.
-- Existing city_admin_access grants still enforce exact city names.
-- No bucket, existing object, auth account, or organization row is changed.
BEGIN;

DROP POLICY IF EXISTS ryadom_places_admin_upload ON storage.objects;
CREATE POLICY ryadom_places_admin_upload
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'ryadom-places'
  AND name ~ '^city-[0-9a-f]+/[0-9a-f-]{36}[.](webp|jpg)$'
  AND EXISTS (
    SELECT 1 FROM public.city_admin_access AS access
    WHERE access.user_id = (SELECT auth.uid())
      AND access.active
      AND (
        (access.city = '*' AND access.role = 'owner')
        OR (
          access.role = 'editor'
          AND (storage.foldername(name))[1] =
            ('city-' || encode(convert_to(access.city,'UTF8'),'hex'))
        )
      )
  )
);

DROP POLICY IF EXISTS ryadom_places_admin_read_uploaded ON storage.objects;
CREATE POLICY ryadom_places_admin_read_uploaded
ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'ryadom-places'
  AND name ~ '^city-[0-9a-f]+/[0-9a-f-]{36}[.](webp|jpg)$'
  AND EXISTS (
    SELECT 1 FROM public.city_admin_access AS access
    WHERE access.user_id = (SELECT auth.uid())
      AND access.active
      AND (
        (access.city = '*' AND access.role = 'owner')
        OR (
          access.role = 'editor'
          AND (storage.foldername(name))[1] =
            ('city-' || encode(convert_to(access.city,'UTF8'),'hex'))
        )
      )
  )
);

DROP POLICY IF EXISTS ryadom_places_admin_delete_uploaded ON storage.objects;
CREATE POLICY ryadom_places_admin_delete_uploaded
ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'ryadom-places'
  AND name ~ '^city-[0-9a-f]+/[0-9a-f-]{36}[.](webp|jpg)$'
  AND EXISTS (
    SELECT 1 FROM public.city_admin_access AS access
    WHERE access.user_id = (SELECT auth.uid())
      AND access.active
      AND (
        (access.city = '*' AND access.role = 'owner')
        OR (
          access.role = 'editor'
          AND (storage.foldername(name))[1] =
            ('city-' || encode(convert_to(access.city,'UTF8'),'hex'))
        )
      )
  )
);

COMMIT;
