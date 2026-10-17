-- «РЯДОМ» intake, private single application photo and city-scoped moderation.
-- Review and test on a disposable database before applying to production.
-- Existing organizations, existing applications, Auth identities and favorites remain untouched.
BEGIN;
ALTER TABLE public.organization_applications ADD COLUMN IF NOT EXISTS photo_path text;
ALTER TABLE public.organization_applications
  ADD CONSTRAINT organization_application_photo_safe
  CHECK (photo_path IS NULL OR (
    char_length(photo_path) < 250
    AND photo_path ~ ('^' || applicant_id::text || '/' || id::text || '/[a-f0-9-]{36}\.(webp|jpg)$')
  ));

-- Only the submitting account may attach a photo while a request is pending.
GRANT UPDATE (photo_path) ON public.organization_applications TO authenticated;
CREATE POLICY application_attach_photo ON public.organization_applications
  FOR UPDATE TO authenticated
  USING (applicant_id=(SELECT auth.uid()) AND status='pending' AND photo_path IS NULL)
  WITH CHECK (applicant_id=(SELECT auth.uid()) AND status='pending');

-- Read is city-scoped: an editor never sees applications from other cities.
CREATE POLICY applications_city_staff_read ON public.organization_applications
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.city_admin_access a
    WHERE a.user_id=(SELECT auth.uid()) AND a.active
      AND (a.city=organization_applications.city OR (a.city='*' AND a.role='owner'))
  ));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('ryadom-org-requests','ryadom-org-requests',false,2097152,ARRAY['image/webp','image/jpeg']::text[])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=2097152,
  allowed_mime_types=ARRAY['image/webp','image/jpeg']::text[];

-- The object path includes a server-owned auth.user UUID AND application UUID.
CREATE POLICY ryadom_org_requests_submit_photo ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id='ryadom-org-requests'
    AND split_part(name,'/',1)=(SELECT auth.uid())::text
    AND (name ~ '^[-a-f0-9]{36}/[-a-f0-9]{36}/[-a-f0-9]{36}\.(webp|jpg)$')
    AND EXISTS (
      SELECT 1 FROM public.organization_applications app
      WHERE app.id::text=split_part(name,'/',2) AND app.applicant_id=(SELECT auth.uid())
        AND app.status='pending' AND app.photo_path IS NULL
    )
  );
CREATE POLICY ryadom_org_requests_review_photo ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='ryadom-org-requests'
    AND EXISTS (
      SELECT 1 FROM public.organization_applications app
      WHERE app.id::text=split_part(name,'/',2)
        AND app.applicant_id::text=split_part(name,'/',1)
        AND (app.applicant_id=(SELECT auth.uid()) OR EXISTS (
          SELECT 1 FROM public.city_admin_access a
          WHERE a.user_id=(SELECT auth.uid()) AND a.active
            AND (a.city=app.city OR (a.city='*' AND a.role='owner'))
        ))
    )
  );
-- Do not allow clients to update or delete intake photos after upload.

CREATE FUNCTION public.review_organization_request(
  p_application_id uuid,p_decision text,p_reviewed_fields jsonb DEFAULT NULL,p_message text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  app public.organization_applications%ROWTYPE;
  actor uuid := auth.uid();
  fresh_id text;
  reviewed_city text;
  reviewed_kind text;
  result_id text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501'; END IF;
  IF p_decision NOT IN ('approved','rejected') OR p_decision IS NULL
    THEN RAISE EXCEPTION 'Invalid review decision' USING ERRCODE='22023'; END IF;
  SELECT * INTO app FROM public.organization_applications WHERE id=p_application_id FOR UPDATE;
  IF app.id IS NULL OR app.status<>'pending'
    THEN RAISE EXCEPTION 'Application not pending' USING ERRCODE='42501'; END IF;
  IF app.applicant_id=actor OR NOT EXISTS(
    SELECT 1 FROM public.city_admin_access a
    WHERE a.user_id=actor AND a.active
      AND (a.city=app.city OR (a.city='*' AND a.role='owner'))
  ) THEN RAISE EXCEPTION 'Not authorized for this city' USING ERRCODE='42501'; END IF;
  IF p_decision='rejected' THEN
    IF p_message IS NULL OR char_length(btrim(p_message)) NOT BETWEEN 10 AND 1000
      THEN RAISE EXCEPTION 'Give a rejection reason (10 to 1000 characters)' USING ERRCODE='22023'; END IF;
    UPDATE public.organization_applications
      SET status='rejected',reviewed_at=now(),review_message=btrim(p_message)
      WHERE id=app.id;
    RETURN 'rejected';
  END IF;
  IF p_reviewed_fields IS NULL OR jsonb_typeof(p_reviewed_fields)<>'object'
    THEN RAISE EXCEPTION 'Reviewed fields required' USING ERRCODE='22023'; END IF;
  reviewed_city:=NULLIF(btrim(p_reviewed_fields->>'city'),'');
  reviewed_kind:=COALESCE(p_reviewed_fields->>'kind','places');
  IF reviewed_city IS DISTINCT FROM app.city
      OR reviewed_kind NOT IN ('places','services')
      OR NULLIF(btrim(p_reviewed_fields->>'title'),'') IS NULL
      OR NULLIF(btrim(p_reviewed_fields->>'category'),'') IS NULL
      OR NULLIF(btrim(p_reviewed_fields->>'description'),'') IS NULL
      OR (p_reviewed_fields->>'status') IS DISTINCT FROM 'published'
    THEN RAISE EXCEPTION 'Reviewed organization must match the application city and be published' USING ERRCODE='22023'; END IF;
  -- Use a fresh ID: never overwrite an existing live directory organization on approval.
  fresh_id:=CASE WHEN reviewed_kind='services' THEN 'service-' ELSE 'place-' END || replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.organizations(
    id,kind,city,title,category,description,address,phone,hours,website,vk_url,
    latitude,longitude,source_type,source_url,verified_at,status,image_url
  ) VALUES (
    fresh_id, reviewed_kind,app.city,btrim(p_reviewed_fields->>'title'),btrim(p_reviewed_fields->>'category'),
    btrim(p_reviewed_fields->>'description'),NULLIF(btrim(p_reviewed_fields->>'address'),''),
    NULLIF(btrim(p_reviewed_fields->>'phone'),''),
    NULLIF(btrim(p_reviewed_fields->>'hours'),''),
    NULLIF(btrim(p_reviewed_fields->>'website'),''),
    NULLIF(btrim(p_reviewed_fields->>'vk_url'),''),
    (p_reviewed_fields->>'latitude')::double precision,
    (p_reviewed_fields->>'longitude')::double precision,
    'manual_verified',NULLIF(btrim(p_reviewed_fields->>'source_url'),''),CURRENT_DATE,
    'published',NULLIF(btrim(p_reviewed_fields->>'image_url'),'')
  );
  UPDATE public.organization_applications SET status='approved', reviewed_at=now(),
    review_message=NULLIF(btrim(p_message),''),organization_id=fresh_id
    WHERE id=app.id;
  RETURN fresh_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_organization_request(uuid,text,jsonb,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_organization_request(uuid,text,jsonb,text) TO authenticated;
COMMIT;
