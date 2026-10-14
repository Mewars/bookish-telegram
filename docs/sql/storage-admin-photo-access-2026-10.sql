-- Fix Supabase Storage upload response visibility (owner/franchise editor only).
-- Supabase Storage INSERT ... RETURNING requires a matching SELECT policy.
-- This migration DOES NOT change auth/users, existing photos, bucket visibility,
-- access grants or photo metadata; it only adds restrictive object policies.
-- A suspended editor (city_admin_access.active = false) loses both capabilities.
BEGIN;

CREATE POLICY ryadom_places_admin_read_uploaded
ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'ryadom-places'
  AND EXISTS (
    SELECT 1 FROM public.city_admin_access AS access
    WHERE access.user_id = (SELECT auth.uid())
      AND access.active
      AND (
        (access.city = '*' AND access.role = 'owner')
        OR (access.city = (storage.foldername(name))[1] AND access.role = 'editor')
      )
  )
);

-- Best-effort cleanup if metadata validation or a subsequent card write fails.
-- Does not permit updates/upsert and does not affect any other bucket.
CREATE POLICY ryadom_places_admin_delete_uploaded
ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'ryadom-places'
  AND EXISTS (
    SELECT 1 FROM public.city_admin_access AS access
    WHERE access.user_id = (SELECT auth.uid())
      AND access.active
      AND (
        (access.city = '*' AND access.role = 'owner')
        OR (access.city = (storage.foldername(name))[1] AND access.role = 'editor')
      )
  )
);

COMMIT;
