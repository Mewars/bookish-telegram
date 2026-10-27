-- РЯДОМ: physical comment deletion and replies. Explicitly approved by the owner.
BEGIN;
CREATE TABLE public.community_comment_rate_log(
 comment_id uuid PRIMARY KEY,
 author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL
);
CREATE INDEX community_comment_rate_author ON public.community_comment_rate_log(author_id,created_at);
ALTER TABLE public.community_comment_rate_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comment_rate_log FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_comment_rate_log FROM PUBLIC,anon,authenticated;
ALTER TABLE public.community_comments ADD COLUMN reply_to uuid REFERENCES public.community_comments(id) ON DELETE SET NULL;
-- Existing table uses column-level SELECT grants; new public reply metadata needs its own grant.
GRANT SELECT(reply_to) ON public.community_comments TO anon,authenticated;
CREATE INDEX community_comments_reply ON public.community_comments(reply_to) WHERE reply_to IS NOT NULL;
CREATE OR REPLACE FUNCTION public.submit_community_comment(p_post_id uuid,p_body text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); result uuid; city_name text; mode text;
BEGIN
 IF u IS NULL OR p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 2 AND 2000
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
CREATE FUNCTION public.reply_community_comment(p_post_id uuid,p_parent_id uuid,p_body text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); result uuid;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 -- Same lock order as submit/delete. Keep the parent alive until the reply is inserted.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,83));
 PERFORM 1 FROM public.community_comments WHERE id=p_parent_id AND post_id=p_post_id AND status='published' FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reply unavailable' USING ERRCODE='42501'; END IF;
 result:=public.submit_community_comment(p_post_id,p_body);
 UPDATE public.community_comments SET reply_to=p_parent_id WHERE id=result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.reply_community_comment(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reply_community_comment(uuid,uuid,text) TO authenticated;
CREATE FUNCTION public.delete_community_comment(p_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); c public.community_comments; initial_author uuid; city_name text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT author_id INTO initial_author FROM public.community_comments WHERE id=p_id;
 IF initial_author IS NULL THEN RAISE EXCEPTION 'Comment unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(initial_author::text,83));
 SELECT * INTO c FROM public.community_comments WHERE id=p_id FOR UPDATE;
 IF c.id IS NULL OR c.author_id IS DISTINCT FROM initial_author THEN RAISE EXCEPTION 'Comment unavailable' USING ERRCODE='42501'; END IF;
 SELECT city INTO city_name FROM public.community_posts WHERE id=c.post_id;
 IF c.author_id<>u AND NOT EXISTS(SELECT 1 FROM public.city_admin_access a WHERE a.user_id=u AND a.active AND
 ((a.city=city_name AND a.role IN ('owner','editor')) OR(a.city='*' AND a.role='owner')))
 THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF c.created_at>now()-interval '1 hour' THEN
 INSERT INTO public.community_comment_rate_log VALUES(c.id,c.author_id,c.created_at) ON CONFLICT DO NOTHING;
 END IF;
 DELETE FROM public.community_comments WHERE id=p_id;
END; $$;
REVOKE ALL ON FUNCTION public.delete_community_comment(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_community_comment(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
