-- Requires resident-comment-removal-v1. Explicit Production permission required.
-- Permit one visible character/emoji; keep Auth, city mode, quota and deletion-proof rate log.
BEGIN;
ALTER TABLE public.community_comments DROP CONSTRAINT community_comments_body_check;
ALTER TABLE public.community_comments ADD CONSTRAINT community_comments_body_check
 CHECK(length(btrim(body)) BETWEEN 1 AND 2000 AND body ~ '[^[:space:]]');
CREATE OR REPLACE FUNCTION public.submit_community_comment(p_post_id uuid,p_body text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); result uuid; city_name text; mode text;
BEGIN
 IF u IS NULL OR p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 1 AND 2000 OR p_body !~ '[^[:space:]]'
 THEN RAISE EXCEPTION 'Invalid comment' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,83));
 SELECT city INTO city_name FROM public.community_posts WHERE id=p_post_id AND status='published';
 IF city_name IS NULL THEN RAISE EXCEPTION 'Post unavailable' USING ERRCODE='42501'; END IF;
 DELETE FROM public.community_comment_rate_log WHERE author_id=u AND created_at<=now()-interval '1 hour';
 IF (SELECT count(*) FROM public.community_comments WHERE author_id=u AND created_at>now()-interval '1 hour')+
    (SELECT count(*) FROM public.community_comment_rate_log WHERE author_id=u AND created_at>now()-interval '1 hour')>=20
 THEN RAISE EXCEPTION 'Too many comments' USING ERRCODE='42501'; END IF;
 SELECT comments_mode INTO mode FROM public.community_wall_settings WHERE city=city_name;
 INSERT INTO public.community_comments(post_id,author_id,body,status)
 VALUES(p_post_id,u,btrim(p_body),CASE WHEN mode='review' THEN 'pending' ELSE 'published' END) RETURNING id INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.submit_community_comment(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_community_comment(uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
