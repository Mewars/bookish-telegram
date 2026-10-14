-- Classified photo albums v1. Apply ONLY to Ryadom-Test before controlled beta.
-- Private storage bucket; never expose drafts through public object URLs.
-- Each listing has at most ten fixed slots. Paths are derived by PostgreSQL.

CREATE TABLE public.classified_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.classifieds(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 0 AND 9),
  format text NOT NULL CHECK (format IN ('webp','jpg')),
  object_path text GENERATED ALWAYS AS
    (listing_id::text || '/' || id::text || '.' || format) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id,slot),
  UNIQUE (object_path)
);
CREATE INDEX classified_photos_listing_order ON public.classified_photos(listing_id,slot);
ALTER TABLE public.classified_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classified_photos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.classified_photos FROM PUBLIC,anon,authenticated;
GRANT SELECT (id,listing_id,uploaded_by,slot,format,object_path,created_at)
  ON public.classified_photos TO anon,authenticated;
GRANT INSERT (id,listing_id,slot,format) ON public.classified_photos TO authenticated;
GRANT DELETE ON public.classified_photos TO authenticated;

-- Separate public SELECT from authenticated staff policies.
-- Guests must never need SELECT privilege on city_admin_access.
CREATE POLICY classified_photos_read_public ON public.classified_photos
FOR SELECT TO anon,authenticated USING (
  EXISTS (SELECT 1 FROM public.classifieds l
    WHERE l.id=listing_id AND l.status IN ('published','completed'))
);
CREATE POLICY classified_photos_read_author ON public.classified_photos
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classifieds l
    WHERE l.id=listing_id AND l.author_id=(SELECT auth.uid()))
);
CREATE POLICY classified_photos_read_moderator ON public.classified_photos
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classifieds l
    WHERE l.id=listing_id AND l.status='pending'
    AND EXISTS(SELECT 1 FROM public.city_admin_access a
      WHERE a.user_id=(SELECT auth.uid()) AND a.active
      AND (a.city=l.city OR (a.city='*' AND a.role='owner'))))
);

CREATE POLICY classified_photos_add_own_draft ON public.classified_photos
FOR INSERT TO authenticated WITH CHECK (
  uploaded_by=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.classifieds l WHERE l.id=listing_id
    AND l.author_id=(SELECT auth.uid()) AND l.status IN ('draft','rejected')
  )
);
CREATE POLICY classified_photos_remove_own_draft ON public.classified_photos
FOR DELETE TO authenticated USING (
  uploaded_by=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.classifieds l WHERE l.id=listing_id
    AND l.author_id=(SELECT auth.uid()) AND l.status IN ('draft','rejected')
  )
);

-- Bucket-level size and MIME validation; no originals, SVG, videos or EXIF.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('ryadom-classified-photos','ryadom-classified-photos',false,2097152,
  ARRAY['image/webp','image/jpeg']::text[])
ON CONFLICT (id) DO NOTHING;

-- Storage metadata must match a reserved slot in classified_photos.
-- Public visitors can sign/read ONLY images of published/completed listings.
-- The private bucket prevents anonymous direct URL discovery.
CREATE POLICY ryadom_classified_photos_read_public ON storage.objects
FOR SELECT TO anon,authenticated USING (
  bucket_id='ryadom-classified-photos' AND EXISTS(
    SELECT 1 FROM public.classified_photos p
    JOIN public.classifieds l ON l.id=p.listing_id
    WHERE p.object_path=name AND l.status IN ('published','completed')
  )
);
CREATE POLICY ryadom_classified_photos_read_author ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id='ryadom-classified-photos' AND EXISTS(
    SELECT 1 FROM public.classified_photos p
    JOIN public.classifieds l ON l.id=p.listing_id
    WHERE p.object_path=name AND l.author_id=(SELECT auth.uid())
  )
);
CREATE POLICY ryadom_classified_photos_read_moderator ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id='ryadom-classified-photos' AND EXISTS(
    SELECT 1 FROM public.classified_photos p
    JOIN public.classifieds l ON l.id=p.listing_id
    WHERE p.object_path=name AND l.status='pending'
    AND EXISTS (SELECT 1 FROM public.city_admin_access a
      WHERE a.user_id=(SELECT auth.uid()) AND a.active
      AND (a.city=l.city OR (a.city='*' AND a.role='owner')))
  )
);
CREATE POLICY ryadom_classified_photos_insert
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='ryadom-classified-photos' AND EXISTS (
    SELECT 1 FROM public.classified_photos p
    JOIN public.classifieds l ON l.id=p.listing_id
    WHERE p.object_path=name AND p.uploaded_by=(SELECT auth.uid())
    AND l.author_id=(SELECT auth.uid()) AND l.status IN ('draft','rejected')
  )
);
CREATE POLICY ryadom_classified_photos_delete
ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id='ryadom-classified-photos' AND EXISTS (
    SELECT 1 FROM public.classified_photos p
    JOIN public.classifieds l ON l.id=p.listing_id
    WHERE p.object_path=name AND p.uploaded_by=(SELECT auth.uid())
    AND l.author_id=(SELECT auth.uid()) AND l.status IN ('draft','rejected')
  )
);
