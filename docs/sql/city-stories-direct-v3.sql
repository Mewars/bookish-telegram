-- Requires city-stories-v1 + city-stories-video-v2. Apply only with Production permission.
-- Publish only the author's completed draft. Existing pending/removed stories are not republished.
BEGIN;
CREATE OR REPLACE FUNCTION public.city_story_capabilities() RETURNS jsonb
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT '{"video":true,"immediate_publish":true,"version":3}'::jsonb; $$;
CREATE OR REPLACE FUNCTION public.submit_city_story(p_id uuid,p_caption text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r public.city_stories; t timestamptz:=clock_timestamp(); path text;
BEGIN
 SELECT * INTO r FROM public.city_stories WHERE id=p_id FOR UPDATE;
 IF u IS NULL OR r.author_id IS DISTINCT FROM u OR p_caption IS NULL OR length(p_caption)>200
 OR NOT EXISTS(SELECT 1 FROM public.city_directory WHERE name=r.city AND active)
 THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
 -- A lost response may be retried, but must not renew expiry or resurrect a removed story.
 IF r.status='published' AND r.caption=btrim(p_caption) THEN RETURN; END IF;
 IF r.status<>'draft' THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
 path:=CASE r.mime_type WHEN 'video/mp4' THEN regexp_replace(r.object_path,'\.webp$','.mp4')
 WHEN 'video/webm' THEN regexp_replace(r.object_path,'\.webp$','.webm') ELSE r.object_path END;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='ryadom-stories' AND o.name=path
 AND o.metadata->>'mimetype'=r.mime_type AND (o.metadata->>'size')::bigint BETWEEN 1 AND
 CASE WHEN r.mime_type='image/webp' THEN 2097152 ELSE 41943040 END)
 THEN RAISE EXCEPTION 'Story photo missing' USING ERRCODE='22023'; END IF;
 UPDATE public.city_stories SET caption=btrim(p_caption),status='published',published_at=t,
 expires_at=t+interval '24 hours',review_reason=NULL WHERE id=p_id;
END; $$;
REVOKE ALL ON FUNCTION public.submit_city_story(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_city_story(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.city_story_capabilities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.city_story_capabilities() TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
