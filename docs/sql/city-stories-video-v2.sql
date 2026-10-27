-- РЯДОМ: videos/editor v2. Requires city-stories-v1; separate Production approval.
-- Existing photos, publication states and city roles are unchanged.
BEGIN;
ALTER TABLE public.city_stories ADD COLUMN mime_type text NOT NULL DEFAULT 'image/webp'
 CHECK(mime_type IN ('image/webp','video/mp4','video/webm'));
CREATE FUNCTION public.city_story_capabilities() RETURNS jsonb
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT '{"video":true,"version":2}'::jsonb$$;
REVOKE ALL ON FUNCTION public.city_story_capabilities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.city_story_capabilities() TO anon,authenticated;
CREATE FUNCTION public.create_city_video_story(p_city text,p_mime text) RETURNS public.city_stories
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.city_stories;
BEGIN
 IF auth.uid() IS NULL OR p_mime IS NULL OR p_mime NOT IN ('video/mp4','video/webm')
 THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
 -- Reuse active-city validation, author snapshot, advisory lock and five-per-day quota.
 r:=public.create_city_story(p_city);
 UPDATE public.city_stories SET mime_type=p_mime WHERE id=r.id RETURNING * INTO r;
 RETURN r;
END; $$;
REVOKE ALL ON FUNCTION public.create_city_video_story(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_city_video_story(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.submit_city_story(p_id uuid,p_caption text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r public.city_stories;
BEGIN
 SELECT * INTO r FROM public.city_stories WHERE id=p_id FOR UPDATE;
 IF u IS NULL OR r.author_id IS DISTINCT FROM u OR p_caption IS NULL OR length(p_caption)>200
 OR NOT EXISTS(SELECT 1 FROM public.city_directory WHERE name=r.city AND active)
 THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
 IF r.status='pending' AND r.caption=btrim(p_caption) THEN RETURN; END IF;
 IF r.status<>'draft' THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='ryadom-stories' AND o.name=(CASE r.mime_type WHEN 'video/mp4' THEN regexp_replace(r.object_path,'\.webp$','.mp4') WHEN 'video/webm' THEN regexp_replace(r.object_path,'\.webp$','.webm') ELSE r.object_path END)
 AND o.metadata->>'mimetype'=r.mime_type AND (o.metadata->>'size')::bigint BETWEEN 1 AND CASE WHEN r.mime_type='image/webp' THEN 2097152 ELSE 41943040 END)
 THEN RAISE EXCEPTION 'Story photo missing' USING ERRCODE='22023'; END IF;
 UPDATE public.city_stories SET caption=btrim(p_caption),status='pending' WHERE id=p_id;
END; $$;
CREATE OR REPLACE FUNCTION public.review_city_story(p_id uuid,p_action text,p_reason text DEFAULT NULL) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r public.city_stories; t timestamptz:=clock_timestamp(); own boolean;
BEGIN
 SELECT * INTO r FROM public.city_stories WHERE id=p_id FOR UPDATE;
 IF u IS NULL OR r.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.city_admin_access a WHERE a.user_id=u AND a.active
 AND ((a.city=r.city AND a.role IN ('owner','editor')) OR(a.city='*' AND a.role='owner')))
 THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.city_admin_access WHERE user_id=u AND active AND city='*' AND role='owner') INTO own;
 IF p_action='approve' AND r.status='pending' THEN
  IF r.author_id=u AND NOT own THEN RAISE EXCEPTION 'Story self approval denied' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='ryadom-stories' AND name=(CASE r.mime_type WHEN 'video/mp4' THEN regexp_replace(r.object_path,'\.webp$','.mp4') WHEN 'video/webm' THEN regexp_replace(r.object_path,'\.webp$','.webm') ELSE r.object_path END))
  THEN RAISE EXCEPTION 'Story photo missing' USING ERRCODE='22023'; END IF;
  UPDATE public.city_stories SET status='published',published_at=t,expires_at=t+interval '24 hours',review_reason=NULL WHERE id=p_id;
 ELSIF p_action='reject' AND r.status='pending' AND length(btrim(p_reason)) BETWEEN 3 AND 500 THEN
  UPDATE public.city_stories SET status='rejected',review_reason=btrim(p_reason) WHERE id=p_id;
 ELSIF p_action='hide' AND r.status='published' THEN
  UPDATE public.city_stories SET status='removed' WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid story review' USING ERRCODE='22023'; END IF;
END; $$;
UPDATE storage.buckets SET file_size_limit=41943040,allowed_mime_types=ARRAY['image/webp','video/mp4','video/webm'] WHERE id='ryadom-stories';
DROP POLICY stories_read_guard ON storage.objects;
DROP POLICY stories_download ON storage.objects;
DROP POLICY stories_upload_guard ON storage.objects;
DROP POLICY stories_upload ON storage.objects;
DROP POLICY stories_no_update ON storage.objects;
DROP POLICY stories_delete_guard ON storage.objects;
DROP POLICY stories_delete ON storage.objects;
CREATE POLICY stories_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(
 bucket_id<>'ryadom-stories' OR EXISTS(
 SELECT 1 FROM public.city_stories WHERE (CASE city_stories.mime_type WHEN 'video/mp4' THEN regexp_replace(city_stories.object_path,'\.webp$','.mp4') WHEN 'video/webm' THEN regexp_replace(city_stories.object_path,'\.webp$','.webm') ELSE city_stories.object_path END)=storage.objects.name AND (
 storage.allow_only_operation('object.get_authenticated') OR (
 (storage.allow_only_operation('object.delete') OR storage.allow_only_operation('object.delete_many'))
 AND author_id=(SELECT auth.uid()) AND status IN ('draft','rejected','removed')))));
CREATE POLICY stories_download ON storage.objects FOR SELECT TO anon,authenticated USING(
 bucket_id='ryadom-stories' AND EXISTS(
 SELECT 1 FROM public.city_stories WHERE (CASE city_stories.mime_type WHEN 'video/mp4' THEN regexp_replace(city_stories.object_path,'\.webp$','.mp4') WHEN 'video/webm' THEN regexp_replace(city_stories.object_path,'\.webp$','.webm') ELSE city_stories.object_path END)=storage.objects.name AND (
 storage.allow_only_operation('object.get_authenticated') OR (
 (storage.allow_only_operation('object.delete') OR storage.allow_only_operation('object.delete_many'))
 AND author_id=(SELECT auth.uid()) AND status IN ('draft','rejected','removed')))));
CREATE POLICY stories_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(
 bucket_id<>'ryadom-stories' OR(storage.allow_only_operation('object.upload') AND EXISTS(SELECT 1 FROM public.city_stories WHERE (CASE city_stories.mime_type WHEN 'video/mp4' THEN regexp_replace(city_stories.object_path,'\.webp$','.mp4') WHEN 'video/webm' THEN regexp_replace(city_stories.object_path,'\.webp$','.webm') ELSE city_stories.object_path END)=storage.objects.name
 AND author_id=(SELECT auth.uid()) AND status='draft')));
CREATE POLICY stories_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='ryadom-stories' AND EXISTS(SELECT 1 FROM public.city_stories WHERE (CASE city_stories.mime_type WHEN 'video/mp4' THEN regexp_replace(city_stories.object_path,'\.webp$','.mp4') WHEN 'video/webm' THEN regexp_replace(city_stories.object_path,'\.webp$','.webm') ELSE city_stories.object_path END)=storage.objects.name
 AND author_id=(SELECT auth.uid()) AND status='draft'));
CREATE POLICY stories_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(bucket_id<>'ryadom-stories') WITH CHECK(bucket_id<>'ryadom-stories');
CREATE POLICY stories_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(
 bucket_id<>'ryadom-stories' OR EXISTS(SELECT 1 FROM public.city_stories WHERE (CASE city_stories.mime_type WHEN 'video/mp4' THEN regexp_replace(city_stories.object_path,'\.webp$','.mp4') WHEN 'video/webm' THEN regexp_replace(city_stories.object_path,'\.webp$','.webm') ELSE city_stories.object_path END)=storage.objects.name
 AND author_id=(SELECT auth.uid()) AND status IN ('draft','rejected','removed')));
CREATE POLICY stories_delete ON storage.objects FOR DELETE TO authenticated USING(
 bucket_id='ryadom-stories' AND EXISTS(SELECT 1 FROM public.city_stories WHERE (CASE city_stories.mime_type WHEN 'video/mp4' THEN regexp_replace(city_stories.object_path,'\.webp$','.mp4') WHEN 'video/webm' THEN regexp_replace(city_stories.object_path,'\.webp$','.webm') ELSE city_stories.object_path END)=storage.objects.name
 AND author_id=(SELECT auth.uid()) AND status IN ('draft','rejected','removed')));
NOTIFY pgrst,'reload schema';
COMMIT;
