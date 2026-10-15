-- «РЯДОМ» / Community feed MVP (Ryadom-Test ONLY).
-- NEVER apply to production before restoring a backup into an isolated database.
-- No public fake content, no location tracking, no VK credentials.

CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL REFERENCES public.city_directory(name),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  post_type text NOT NULL CHECK (post_type IN ('post','question','news')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 160),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 10 AND 5000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published','rejected','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_public_city ON public.community_posts(city,created_at DESC)
  WHERE status='published';
CREATE INDEX community_author ON public.community_posts(author_id,created_at DESC);
CREATE INDEX community_pending_city ON public.community_posts(city,created_at)
  WHERE status='pending';

CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 2 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected','archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_comments_public ON public.community_comments(post_id,created_at)
  WHERE status='published';
CREATE INDEX community_comments_pending ON public.community_comments(post_id,created_at)
  WHERE status='pending';
CREATE INDEX community_comments_author ON public.community_comments(author_id,created_at DESC);

CREATE FUNCTION public.community_touch_post() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END;
$$;
CREATE TRIGGER community_update_post BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.community_touch_post();
REVOKE ALL ON FUNCTION public.community_touch_post() FROM PUBLIC;

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.community_posts,public.community_comments FROM PUBLIC,anon,authenticated;
GRANT SELECT (id,city,author_id,post_type,title,body,status,created_at,updated_at)
  ON public.community_posts TO anon,authenticated;
-- Browser inserts are deliberately disabled. New drafts use the rate-limited RPC.
GRANT UPDATE (title,body,status) ON public.community_posts TO authenticated;
GRANT SELECT (id,post_id,author_id,body,status,created_at)
  ON public.community_comments TO anon,authenticated;

-- Public reading does not require staff privileges.
CREATE POLICY community_posts_public_read ON public.community_posts
FOR SELECT TO anon,authenticated USING (status='published');
CREATE POLICY community_posts_own_read ON public.community_posts
FOR SELECT TO authenticated USING (author_id=(SELECT auth.uid()));
CREATE POLICY community_posts_pending_editor_read ON public.community_posts
FOR SELECT TO authenticated USING (
  status='pending' AND EXISTS(
    SELECT 1 FROM public.city_admin_access a WHERE a.user_id=(SELECT auth.uid())
      AND a.active AND (a.city=community_posts.city OR (a.city='*' AND a.role='owner'))
  )
);
-- Residents may submit only ordinary posts or questions. Editorial NEWS requires trusted RPC.
CREATE POLICY community_posts_resident_insert ON public.community_posts
FOR INSERT TO authenticated WITH CHECK (
  author_id=(SELECT auth.uid()) AND status='draft' AND post_type IN ('post','question')
  AND EXISTS(SELECT 1 FROM public.city_directory c WHERE c.name=city AND c.active)
);
CREATE POLICY community_posts_author_edit ON public.community_posts
FOR UPDATE TO authenticated USING (
  author_id=(SELECT auth.uid()) AND status IN ('draft','rejected')
) WITH CHECK (
  author_id=(SELECT auth.uid()) AND status IN ('draft','pending')
);

CREATE POLICY community_comments_public_read ON public.community_comments
FOR SELECT TO anon,authenticated USING (
  status='published' AND EXISTS (
    SELECT 1 FROM public.community_posts p WHERE p.id=post_id AND p.status='published'
  )
);
CREATE POLICY community_comments_author_read ON public.community_comments
FOR SELECT TO authenticated USING (author_id=(SELECT auth.uid()));
CREATE POLICY community_comments_editor_pending_read ON public.community_comments
FOR SELECT TO authenticated USING (
  status='pending' AND EXISTS (
    SELECT 1 FROM public.community_posts p
      JOIN public.city_admin_access a ON a.user_id=(SELECT auth.uid()) AND a.active
        AND (a.city=p.city OR (a.city='*' AND a.role='owner'))
      WHERE p.id=post_id AND p.status='published'
  )
);

-- Create resident drafts only through a server-side, rate-limited action.
-- Derive the actor from the authenticated JWT, not a caller-supplied UUID.
CREATE FUNCTION public.create_community_post(
  p_city text,p_type text,p_title text,p_body text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $
DECLARE v_user uuid:=auth.uid(); v_id uuid;
BEGIN
  IF v_user IS NULL OR p_type NOT IN ('post','question')
    OR p_city IS NULL OR p_title IS NULL OR p_body IS NULL
    OR length(btrim(p_title)) NOT BETWEEN 5 AND 160
    OR length(btrim(p_body)) NOT BETWEEN 10 AND 5000
    OR NOT EXISTS(SELECT 1 FROM public.city_directory c WHERE c.name=p_city AND c.active)
  THEN RAISE EXCEPTION 'Invalid community post' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,84));
  IF (SELECT count(*) FROM public.community_posts
     WHERE author_id=v_user AND created_at>now()-interval '1 day')>=10
  THEN RAISE EXCEPTION 'Daily post limit reached' USING ERRCODE='42501'; END IF;
  INSERT INTO public.community_posts(city,author_id,post_type,title,body,status)
    VALUES(p_city,v_user,p_type,btrim(p_title),btrim(p_body),'draft')
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$;
REVOKE ALL ON FUNCTION public.create_community_post(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_community_post(text,text,text,text) TO authenticated;

-- A separate staff account must review user posts; authors cannot approve themselves.
CREATE FUNCTION public.review_community_post(p_id uuid,p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_author uuid; v_city text; v_status text;
BEGIN
  IF v_user IS NULL OR p_approve IS NULL THEN
    RAISE EXCEPTION 'Invalid moderator request' USING ERRCODE='42501';
  END IF;
  SELECT author_id,city,status INTO v_author,v_city,v_status
    FROM public.community_posts WHERE id=p_id FOR UPDATE;
  IF v_city IS NULL OR v_status<>'pending' THEN
    RAISE EXCEPTION 'Post unavailable for review' USING ERRCODE='42501';
  END IF;
  IF v_author=v_user OR NOT EXISTS(
    SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active
    AND (a.city=v_city OR (a.city='*' AND a.role='owner'))
  ) THEN RAISE EXCEPTION 'Not authorized for this city' USING ERRCODE='42501'; END IF;
  UPDATE public.community_posts
    SET status=CASE WHEN p_approve THEN 'published' ELSE 'rejected' END
    WHERE id=p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_community_post(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_community_post(uuid,boolean) TO authenticated;

-- Staff-created city news is editorial and never impersonates a resident.
CREATE FUNCTION public.publish_city_news(p_city text,p_title text,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_id uuid;
BEGIN
  IF v_user IS NULL OR p_city IS NULL OR p_title IS NULL OR p_body IS NULL
    OR length(btrim(p_title)) NOT BETWEEN 5 AND 160
    OR length(btrim(p_body)) NOT BETWEEN 10 AND 5000
    OR NOT EXISTS(SELECT 1 FROM public.city_directory c WHERE c.name=p_city AND c.active)
    OR NOT EXISTS(
      SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active
      AND (a.city=p_city OR (a.city='*' AND a.role='owner'))
    )
  THEN RAISE EXCEPTION 'Not authorized to publish city news' USING ERRCODE='42501'; END IF;
  INSERT INTO public.community_posts(city,author_id,post_type,title,body,status)
    VALUES (p_city,v_user,'news',btrim(p_title),btrim(p_body),'published')
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_city_news(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_city_news(text,text,text) TO authenticated;

-- Comment creation via RPC allows server-side rate limits and actor derivation.
CREATE FUNCTION public.submit_community_comment(p_post_id uuid,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_id uuid;
BEGIN
  IF v_user IS NULL OR p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 2 AND 2000 THEN
    RAISE EXCEPTION 'Invalid comment' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,83));
  IF NOT EXISTS(SELECT 1 FROM public.community_posts p WHERE p.id=p_post_id AND p.status='published')
  THEN RAISE EXCEPTION 'Post unavailable for comments' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM public.community_comments
      WHERE author_id=v_user AND created_at>now()-interval '1 hour')>=20
  THEN RAISE EXCEPTION 'Too many comments' USING ERRCODE='42501'; END IF;
  INSERT INTO public.community_comments(post_id,author_id,body)
    VALUES (p_post_id,v_user,btrim(p_body)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_community_comment(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_community_comment(uuid,text) TO authenticated;

CREATE FUNCTION public.review_community_comment(p_id uuid,p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_author uuid; v_city text; v_status text; v_post_status text;
BEGIN
  IF v_user IS NULL OR p_approve IS NULL THEN
    RAISE EXCEPTION 'Invalid moderator request' USING ERRCODE='42501'; END IF;
  SELECT c.author_id,c.status,p.city,p.status INTO v_author,v_status,v_city,v_post_status
    FROM public.community_comments c
    JOIN public.community_posts p ON p.id=c.post_id
    WHERE c.id=p_id FOR UPDATE OF c;
  IF v_city IS NULL OR v_status<>'pending' OR v_post_status<>'published' THEN
    RAISE EXCEPTION 'Comment unavailable for review' USING ERRCODE='42501'; END IF;
  IF v_author=v_user OR NOT EXISTS(
    SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active
    AND (a.city=v_city OR (a.city='*' AND a.role='owner'))
  ) THEN RAISE EXCEPTION 'Not authorized for this city' USING ERRCODE='42501'; END IF;
  UPDATE public.community_comments
    SET status=CASE WHEN p_approve THEN 'published' ELSE 'rejected' END
    WHERE id=p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_community_comment(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_community_comment(uuid,boolean) TO authenticated;
