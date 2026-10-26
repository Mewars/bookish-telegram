-- РЯДОМ: stories v1. Apply once, only after explicit Production approval.
-- Does not alter existing posts, users, roles, buckets or their policies.
BEGIN;
CREATE TABLE public.city_stories(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 city text NOT NULL REFERENCES public.city_directory(name),
 author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 author_label text NOT NULL CHECK(length(author_label) BETWEEN 1 AND 100),
 caption text NOT NULL DEFAULT '' CHECK(length(caption)<=200),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','published','rejected','removed')),
 object_path text GENERATED ALWAYS AS(author_id::text||'/'||id::text||'.webp') STORED UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,
 expires_at timestamptz,
 review_reason text CHECK(length(review_reason)<=500),
 CHECK(status<>'published' OR (published_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at=published_at+interval '24 hours')),
 CHECK(status<>'rejected' OR (review_reason IS NOT NULL AND length(btrim(review_reason))>0))
);
CREATE INDEX city_stories_public ON public.city_stories(city,published_at DESC) WHERE status='published';
CREATE INDEX city_stories_queue ON public.city_stories(city,created_at) WHERE status='pending';
CREATE INDEX city_stories_author ON public.city_stories(author_id,created_at DESC);
ALTER TABLE public.city_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_stories FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.city_stories FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.city_stories TO anon,authenticated;
CREATE POLICY stories_public ON public.city_stories FOR SELECT TO anon,authenticated
 USING(status='published' AND expires_at>now());
CREATE POLICY stories_author ON public.city_stories FOR SELECT TO authenticated USING(author_id=(SELECT auth.uid()));
CREATE POLICY stories_staff ON public.city_stories FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.city_admin_access a WHERE a.user_id=(SELECT auth.uid()) AND a.active
 AND ((a.city=city_stories.city AND a.role IN ('owner','editor')) OR(a.city='*' AND a.role='owner'))));

CREATE TABLE public.city_story_reports(
 story_id uuid NOT NULL REFERENCES public.city_stories(id) ON DELETE CASCADE,
 reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 500),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(story_id,reporter_id)
);
CREATE INDEX city_story_reports_created ON public.city_story_reports(created_at DESC);
ALTER TABLE public.city_story_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_story_reports FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.city_story_reports FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.city_story_reports TO authenticated;
CREATE POLICY stories_reports_self ON public.city_story_reports FOR SELECT TO authenticated USING(reporter_id=(SELECT auth.uid()));
CREATE POLICY stories_reports_staff ON public.city_story_reports FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.city_stories s JOIN public.city_admin_access a ON a.user_id=(SELECT auth.uid()) AND a.active
 AND ((a.city=s.city AND a.role IN ('owner','editor')) OR(a.city='*' AND a.role='owner')) WHERE s.id=story_id));

CREATE FUNCTION public.list_city_stories(p_city text) RETURNS SETOF public.city_stories
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM public.city_stories WHERE city=p_city AND status='published' AND expires_at>now() ORDER BY published_at DESC,id LIMIT 50; $$;
REVOKE ALL ON FUNCTION public.list_city_stories(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_city_stories(text) TO anon,authenticated;

CREATE FUNCTION public.create_city_story(p_city text) RETURNS public.city_stories
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r public.city_stories;
BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM public.city_directory WHERE name=p_city AND active)
 THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,267));
 IF (SELECT count(*) FROM public.city_stories WHERE author_id=u AND created_at>now()-interval '24 hours')>=5
 THEN RAISE EXCEPTION 'Story daily limit' USING ERRCODE='42501'; END IF;
 INSERT INTO public.city_stories(city,author_id,author_label)
 VALUES(p_city,u,COALESCE((SELECT left(nullif(btrim(display_name),''),100) FROM public.profiles WHERE id=u),'Житель города')) RETURNING * INTO r;
 RETURN r;
END; $$;
CREATE FUNCTION public.submit_city_story(p_id uuid,p_caption text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r public.city_stories;
BEGIN
 SELECT * INTO r FROM public.city_stories WHERE id=p_id FOR UPDATE;
 IF u IS NULL OR r.author_id IS DISTINCT FROM u OR p_caption IS NULL OR length(p_caption)>200
 OR NOT EXISTS(SELECT 1 FROM public.city_directory WHERE name=r.city AND active)
 THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
 IF r.status='pending' AND r.caption=btrim(p_caption) THEN RETURN; END IF;
 IF r.status<>'draft' THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='ryadom-stories' AND o.name=r.object_path
 AND o.metadata->>'mimetype'='image/webp' AND (o.metadata->>'size')::bigint BETWEEN 1 AND 2097152)
 THEN RAISE EXCEPTION 'Story photo missing' USING ERRCODE='22023'; END IF;
 UPDATE public.city_stories SET caption=btrim(p_caption),status='pending' WHERE id=p_id;
END; $$;
CREATE FUNCTION public.review_city_story(p_id uuid,p_action text,p_reason text DEFAULT NULL) RETURNS void
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
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='ryadom-stories' AND name=r.object_path)
  THEN RAISE EXCEPTION 'Story photo missing' USING ERRCODE='22023'; END IF;
  UPDATE public.city_stories SET status='published',published_at=t,expires_at=t+interval '24 hours',review_reason=NULL WHERE id=p_id;
 ELSIF p_action='reject' AND r.status='pending' AND length(btrim(p_reason)) BETWEEN 3 AND 500 THEN
  UPDATE public.city_stories SET status='rejected',review_reason=btrim(p_reason) WHERE id=p_id;
 ELSIF p_action='hide' AND r.status='published' THEN
  UPDATE public.city_stories SET status='removed' WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid story review' USING ERRCODE='22023'; END IF;
END; $$;
CREATE FUNCTION public.remove_city_story(p_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
 UPDATE public.city_stories SET status='removed' WHERE id=p_id AND author_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
END; $$;
CREATE FUNCTION public.report_city_story(p_id uuid,p_reason text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 OR NOT EXISTS(
 SELECT 1 FROM public.city_stories WHERE id=p_id AND status='published' AND expires_at>now())
 THEN RAISE EXCEPTION 'Story not authorized' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,268));
 IF (SELECT count(*) FROM public.city_story_reports WHERE reporter_id=u AND created_at>now()-interval '24 hours')>=10
 THEN RAISE EXCEPTION 'Story report limit' USING ERRCODE='42501'; END IF;
 INSERT INTO public.city_story_reports(story_id,reporter_id,reason) VALUES(p_id,u,btrim(p_reason));
END; $$;
REVOKE ALL ON FUNCTION public.create_city_story(text),public.submit_city_story(uuid,text),public.review_city_story(uuid,text,text),public.remove_city_story(uuid),public.report_city_story(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_city_story(text),public.submit_city_story(uuid,text),public.review_city_story(uuid,text,text),public.remove_city_story(uuid),public.report_city_story(uuid,text) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('ryadom-stories','ryadom-stories',false,2097152,ARRAY['image/webp']);
-- No object signing/listing. Every download rechecks row visibility and expiry.
-- Restrictive guard also prevents unrelated permissive bucket policies from widening access.
CREATE POLICY stories_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(
 bucket_id<>'ryadom-stories' OR EXISTS(
 SELECT 1 FROM public.city_stories WHERE object_path=storage.objects.name AND (
 storage.allow_only_operation('object.get_authenticated') OR (
 (storage.allow_only_operation('object.delete') OR storage.allow_only_operation('object.delete_many'))
 AND author_id=(SELECT auth.uid()) AND status IN ('draft','rejected','removed')))));
CREATE POLICY stories_download ON storage.objects FOR SELECT TO anon,authenticated USING(
 bucket_id='ryadom-stories' AND EXISTS(
 SELECT 1 FROM public.city_stories WHERE object_path=storage.objects.name AND (
 storage.allow_only_operation('object.get_authenticated') OR (
 (storage.allow_only_operation('object.delete') OR storage.allow_only_operation('object.delete_many'))
 AND author_id=(SELECT auth.uid()) AND status IN ('draft','rejected','removed')))));
CREATE POLICY stories_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(
 bucket_id<>'ryadom-stories' OR(storage.allow_only_operation('object.upload') AND EXISTS(SELECT 1 FROM public.city_stories WHERE object_path=storage.objects.name
 AND author_id=(SELECT auth.uid()) AND status='draft')));
CREATE POLICY stories_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='ryadom-stories' AND EXISTS(SELECT 1 FROM public.city_stories WHERE object_path=storage.objects.name
 AND author_id=(SELECT auth.uid()) AND status='draft'));
CREATE POLICY stories_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(bucket_id<>'ryadom-stories') WITH CHECK(bucket_id<>'ryadom-stories');
CREATE POLICY stories_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(
 bucket_id<>'ryadom-stories' OR EXISTS(SELECT 1 FROM public.city_stories WHERE object_path=storage.objects.name
 AND author_id=(SELECT auth.uid()) AND status IN ('draft','rejected','removed')));
CREATE POLICY stories_delete ON storage.objects FOR DELETE TO authenticated USING(
 bucket_id='ryadom-stories' AND EXISTS(SELECT 1 FROM public.city_stories WHERE object_path=storage.objects.name
 AND author_id=(SELECT auth.uid()) AND status IN ('draft','rejected','removed')));
NOTIFY pgrst,'reload schema';
COMMIT;
