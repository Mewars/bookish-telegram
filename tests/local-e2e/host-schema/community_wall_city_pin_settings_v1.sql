-- Local integration fixture, copied from Production migration community_wall_city_pin_settings_v1.
-- Never apply this historical fixture to a hosted project.
CREATE TABLE public.community_wall_settings(
 city text PRIMARY KEY REFERENCES public.city_directory(name),
 posts_mode text NOT NULL DEFAULT 'review' CHECK(posts_mode IN ('review','open')),
 comments_mode text NOT NULL DEFAULT 'open' CHECK(comments_mode IN ('review','open')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_wall_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY community_settings_public ON public.community_wall_settings FOR SELECT TO anon,authenticated USING(true);
REVOKE ALL ON public.community_wall_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT(city,posts_mode,comments_mode) ON public.community_wall_settings TO anon,authenticated;

ALTER TABLE public.community_posts ADD COLUMN pinned_at timestamptz, ADD COLUMN pinned_by uuid;
CREATE UNIQUE INDEX community_one_pin_per_city ON public.community_posts(city) WHERE pinned_at IS NOT NULL;
GRANT SELECT(pinned_at) ON public.community_posts TO anon,authenticated;
CREATE POLICY community_posts_city_staff_manage_read ON public.community_posts FOR SELECT TO authenticated USING (
 status IN ('rejected','archived') AND EXISTS(
  SELECT 1 FROM public.city_admin_access a WHERE a.user_id=(SELECT auth.uid()) AND a.active
    AND (a.city=community_posts.city OR (a.city='*' AND a.role='owner'))
 )
);
CREATE POLICY community_comments_city_staff_manage_read ON public.community_comments FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.community_posts p JOIN public.city_admin_access a
   ON a.user_id=(SELECT auth.uid()) AND a.active AND (a.city=p.city OR (a.city='*' AND a.role='owner'))
   WHERE p.id=post_id AND p.status IN ('published','archived'))
);

CREATE OR REPLACE FUNCTION public.community_submit_post(p_post_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();v_author uuid;v_city text;v_status text;v_mode text;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 SELECT author_id,city,status INTO v_author,v_city,v_status FROM public.community_posts WHERE id=p_post_id FOR UPDATE;
 IF v_city IS NULL OR v_author<>v_user OR v_status NOT IN ('draft','rejected') THEN
  RAISE EXCEPTION 'Post unavailable for submission' USING ERRCODE='42501'; END IF;
 SELECT posts_mode INTO v_mode FROM public.community_wall_settings WHERE city=v_city;
 IF v_mode IS DISTINCT FROM 'open' THEN v_mode:='review'; END IF;
 UPDATE public.community_posts SET status=CASE WHEN v_mode='open' THEN 'published' ELSE 'pending' END WHERE id=p_post_id;
 RETURN CASE WHEN v_mode='open' THEN 'published' ELSE 'pending' END;
END;$$;
REVOKE ALL ON FUNCTION public.community_submit_post(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_submit_post(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_community_wall_settings(
 p_city text,p_posts_mode text,p_comments_mode text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR p_posts_mode NOT IN ('open','review') OR p_comments_mode NOT IN ('open','review')
 OR NOT EXISTS (SELECT 1 FROM public.city_admin_access a WHERE a.user_id=auth.uid() AND a.active
 AND (a.city=p_city OR (a.city='*' AND a.role='owner'))) THEN
  RAISE EXCEPTION 'Not authorized to edit city wall' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.community_wall_settings(city,posts_mode,comments_mode) VALUES(p_city,p_posts_mode,p_comments_mode)
 ON CONFLICT(city) DO UPDATE SET posts_mode=EXCLUDED.posts_mode,comments_mode=EXCLUDED.comments_mode,updated_at=now();
END;$$;
REVOKE ALL ON FUNCTION public.set_community_wall_settings(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_community_wall_settings(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_community_post(p_id uuid,p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();v_author uuid;v_city text;v_status text;v_owner boolean;
BEGIN
 IF v_user IS NULL OR p_approve IS NULL THEN RAISE EXCEPTION 'Invalid moderator request' USING ERRCODE='42501'; END IF;
 SELECT author_id,city,status INTO v_author,v_city,v_status FROM public.community_posts WHERE id=p_id FOR UPDATE;
 IF v_city IS NULL OR v_status<>'pending' THEN RAISE EXCEPTION 'Post unavailable for review' USING ERRCODE='42501'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active AND a.city='*' AND a.role='owner') INTO v_owner;
 IF NOT v_owner AND (v_author=v_user OR NOT EXISTS(
   SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active AND a.city=v_city AND a.role IN ('editor','owner')
 )) THEN RAISE EXCEPTION 'Not authorized for this city' USING ERRCODE='42501'; END IF;
 UPDATE public.community_posts SET status=CASE WHEN p_approve THEN 'published' ELSE 'rejected' END WHERE id=p_id;
END;$$;
REVOKE ALL ON FUNCTION public.review_community_post(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_community_post(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.moderate_community_post(p_post_id uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_city text;v_user uuid:=auth.uid();v_status text;
BEGIN
 IF p_action NOT IN ('pin','unpin','hide') OR v_user IS NULL THEN RAISE EXCEPTION 'Invalid moderation action' USING ERRCODE='42501'; END IF;
 SELECT city,status INTO v_city,v_status FROM public.community_posts WHERE id=p_post_id FOR UPDATE;
 IF v_city IS NULL OR v_status NOT IN ('published','pending','rejected','archived') THEN
  RAISE EXCEPTION 'Post not found' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active
   AND (a.city=v_city OR (a.city='*' AND a.role='owner'))) THEN
   RAISE EXCEPTION 'Not authorized for this city' USING ERRCODE='42501'; END IF;
 IF p_action IN ('pin','unpin') AND v_status<>'published' THEN RAISE EXCEPTION 'Only published posts can be pinned' USING ERRCODE='42501'; END IF;
 IF p_action='pin' THEN
  UPDATE public.community_posts SET pinned_at=NULL,pinned_by=NULL WHERE city=v_city AND pinned_at IS NOT NULL;
  UPDATE public.community_posts SET pinned_at=now(),pinned_by=v_user WHERE id=p_post_id;
 ELSIF p_action='unpin' THEN
  UPDATE public.community_posts SET pinned_at=NULL,pinned_by=NULL WHERE id=p_post_id;
 ELSE
  UPDATE public.community_posts SET status='archived',pinned_at=NULL,pinned_by=NULL WHERE id=p_post_id;
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.moderate_community_post(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.moderate_community_post(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_community_comment(p_post_id uuid,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();v_id uuid;v_city text;v_mode text;
BEGIN
 IF v_user IS NULL OR p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 2 AND 2000
 THEN RAISE EXCEPTION 'Invalid comment' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,83));
 SELECT city INTO v_city FROM public.community_posts WHERE id=p_post_id AND status='published';
 IF v_city IS NULL THEN RAISE EXCEPTION 'Post unavailable' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.community_comments
      WHERE author_id=v_user AND created_at>now()-interval '1 hour')>=20 THEN
  RAISE EXCEPTION 'Too many comments' USING ERRCODE='42501'; END IF;
 SELECT comments_mode INTO v_mode FROM public.community_wall_settings WHERE city=v_city;
 INSERT INTO public.community_comments(post_id,author_id,body,status)
 VALUES(p_post_id,v_user,btrim(p_body),CASE WHEN v_mode='review' THEN 'pending' ELSE 'published' END) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.submit_community_comment(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_community_comment(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_community_comment(p_id uuid,p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();v_author uuid;v_city text;v_status text;v_post_status text;v_owner boolean;
BEGIN
 IF v_user IS NULL OR p_approve IS NULL THEN RAISE EXCEPTION 'Invalid moderator request' USING ERRCODE='42501'; END IF;
 SELECT c.author_id,c.status,p.city,p.status INTO v_author,v_status,v_city,v_post_status
 FROM public.community_comments c JOIN public.community_posts p ON p.id=c.post_id
 WHERE c.id=p_id FOR UPDATE OF c;
 IF v_city IS NULL OR v_status<>'pending' OR v_post_status<>'published' THEN
  RAISE EXCEPTION 'Comment unavailable for review' USING ERRCODE='42501'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active AND a.city='*' AND a.role='owner') INTO v_owner;
 IF NOT v_owner AND (v_author=v_user OR NOT EXISTS(SELECT 1 FROM public.city_admin_access a
 WHERE a.user_id=v_user AND a.active AND a.city=v_city AND a.role IN ('editor','owner'))) THEN
 RAISE EXCEPTION 'Not authorized for this city' USING ERRCODE='42501'; END IF;
 UPDATE public.community_comments SET status=CASE WHEN p_approve THEN 'published' ELSE 'rejected' END WHERE id=p_id;
END;$$;
REVOKE ALL ON FUNCTION public.review_community_comment(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_community_comment(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.hide_community_comment(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();v_city text;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 SELECT p.city INTO v_city FROM public.community_comments c JOIN public.community_posts p ON p.id=c.post_id WHERE c.id=p_id;
 IF v_city IS NULL OR NOT EXISTS(SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active
  AND (a.city=v_city OR (a.city='*' AND a.role='owner'))) THEN
  RAISE EXCEPTION 'Not authorized for this city' USING ERRCODE='42501'; END IF;
 UPDATE public.community_comments SET status='archived' WHERE id=p_id;
END;$$;
REVOKE ALL ON FUNCTION public.hide_community_comment(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hide_community_comment(uuid) TO authenticated;
