-- Local integration fixture, copied from Production migration community_wall_photos_likes_v1.
-- Never apply this historical fixture to a hosted project.
CREATE TABLE public.community_post_photos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
 uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 slot smallint NOT NULL CHECK(slot BETWEEN 0 AND 3),
 format text NOT NULL CHECK(format IN ('webp','jpg')),
 object_path text GENERATED ALWAYS AS(post_id::text||'/'||id::text||'.'||format) STORED,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(post_id,slot), UNIQUE(object_path)
);
CREATE INDEX community_photo_post_idx ON public.community_post_photos(post_id,slot);
ALTER TABLE public.community_post_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_photos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_post_photos FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,post_id,uploaded_by,slot,format,object_path,created_at) ON public.community_post_photos TO anon,authenticated;
GRANT INSERT(id,post_id,slot,format) ON public.community_post_photos TO authenticated;
GRANT DELETE ON public.community_post_photos TO authenticated;

CREATE POLICY community_photo_public_read ON public.community_post_photos FOR SELECT TO anon,authenticated USING(
 EXISTS(SELECT 1 FROM public.community_posts p WHERE p.id=post_id AND p.status='published')
);
CREATE POLICY community_photo_author_read ON public.community_post_photos FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.community_posts p WHERE p.id=post_id AND p.author_id=(SELECT auth.uid()))
);
CREATE POLICY community_photo_staff_read ON public.community_post_photos FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.community_posts p JOIN public.city_admin_access a
 ON a.user_id=(SELECT auth.uid()) AND a.active AND (a.city=p.city OR(a.city='*' AND a.role='owner'))
 WHERE p.id=post_id AND p.status='pending')
);
CREATE POLICY community_photo_create ON public.community_post_photos FOR INSERT TO authenticated WITH CHECK(
 uploaded_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.community_posts p
 WHERE p.id=post_id AND p.author_id=(SELECT auth.uid()) AND p.status IN ('draft','rejected'))
);
CREATE POLICY community_photo_remove_draft ON public.community_post_photos FOR DELETE TO authenticated USING(
 uploaded_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.community_posts p
 WHERE p.id=post_id AND p.author_id=(SELECT auth.uid()) AND p.status IN ('draft','rejected'))
);

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('ryadom-wall-photos','ryadom-wall-photos',false,2097152,ARRAY['image/webp','image/jpeg']::text[])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY ryadom_wall_photos_public_read ON storage.objects FOR SELECT TO anon,authenticated USING(
 bucket_id='ryadom-wall-photos' AND EXISTS(
 SELECT 1 FROM public.community_post_photos ph JOIN public.community_posts p ON p.id=ph.post_id
 WHERE ph.object_path=storage.objects.name AND p.status='published')
);
CREATE POLICY ryadom_wall_photos_author_read ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='ryadom-wall-photos' AND EXISTS(
 SELECT 1 FROM public.community_post_photos ph JOIN public.community_posts p ON p.id=ph.post_id
 WHERE ph.object_path=storage.objects.name AND p.author_id=(SELECT auth.uid()))
);
CREATE POLICY ryadom_wall_photos_staff_read ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='ryadom-wall-photos' AND EXISTS(
 SELECT 1 FROM public.community_post_photos ph JOIN public.community_posts p ON p.id=ph.post_id
 JOIN public.city_admin_access a ON a.user_id=(SELECT auth.uid()) AND a.active
  AND (a.city=p.city OR(a.city='*' AND a.role='owner'))
 WHERE ph.object_path=storage.objects.name AND p.status='pending')
);
CREATE POLICY ryadom_wall_photos_author_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='ryadom-wall-photos' AND EXISTS(
 SELECT 1 FROM public.community_post_photos ph JOIN public.community_posts p ON p.id=ph.post_id
 WHERE ph.object_path=storage.objects.name AND ph.uploaded_by=(SELECT auth.uid())
 AND p.author_id=(SELECT auth.uid()) AND p.status IN ('draft','rejected'))
);
CREATE POLICY ryadom_wall_photos_author_delete ON storage.objects FOR DELETE TO authenticated USING(
 bucket_id='ryadom-wall-photos' AND EXISTS(
 SELECT 1 FROM public.community_post_photos ph JOIN public.community_posts p ON p.id=ph.post_id
 WHERE ph.object_path=storage.objects.name AND ph.uploaded_by=(SELECT auth.uid())
 AND p.author_id=(SELECT auth.uid()) AND p.status IN ('draft','rejected'))
);

CREATE TABLE public.community_post_likes(
 post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(post_id,user_id)
);
CREATE INDEX community_post_likes_user_idx ON public.community_post_likes(user_id);
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_post_likes FROM PUBLIC,anon,authenticated;
GRANT SELECT(post_id,user_id) ON public.community_post_likes TO authenticated;
CREATE POLICY community_post_likes_read_self ON public.community_post_likes FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.toggle_community_post_like(p_post_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.community_posts WHERE id=p_post_id AND status='published')
 THEN RAISE EXCEPTION 'Post unavailable for reaction' USING ERRCODE='42501'; END IF;
 DELETE FROM public.community_post_likes WHERE post_id=p_post_id AND user_id=v_user;
 IF FOUND THEN RETURN false; END IF;
 INSERT INTO public.community_post_likes(post_id,user_id) VALUES(p_post_id,v_user) ON CONFLICT DO NOTHING;
 RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.toggle_community_post_like(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.toggle_community_post_like(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_like_summary(p_ids uuid[])
RETURNS TABLE(post_id uuid,like_count bigint,liked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,count(l.user_id)::bigint,
        COALESCE(bool_or(l.user_id=auth.uid()),false) AS liked
 FROM public.community_posts p
 LEFT JOIN public.community_post_likes l ON l.post_id=p.id
 WHERE p.id=ANY(p_ids) AND p.status='published' AND cardinality(p_ids) BETWEEN 1 AND 50
 GROUP BY p.id;
$$;
REVOKE ALL ON FUNCTION public.community_like_summary(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_like_summary(uuid[]) TO anon,authenticated;
