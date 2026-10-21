-- Resident wall review: apply together with the updated /wall/ client.
-- Reasons are private: never add them to the public post SELECT projection.
CREATE TABLE public.community_post_review_reasons (
  post_id uuid PRIMARY KEY REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 1000),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_post_review_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_review_reasons FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_post_review_reasons FROM PUBLIC,anon,authenticated;
GRANT SELECT(post_id,reason,reviewed_at) ON public.community_post_review_reasons TO authenticated;
-- Test and older installations also need staff visibility of rejected parents.
CREATE POLICY community_posts_review_reason_staff_read ON public.community_posts
FOR SELECT TO authenticated USING (
 status='rejected' AND EXISTS (
  SELECT 1 FROM public.city_admin_access a WHERE a.user_id=(SELECT auth.uid()) AND a.active
   AND a.role IN ('owner','editor') AND (a.city=community_posts.city OR (a.city='*' AND a.role='owner'))
 )
);
CREATE POLICY community_review_reason_author_or_staff ON public.community_post_review_reasons
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.community_posts p
    WHERE p.id=post_id AND (
      p.author_id=(SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.city_admin_access a
        WHERE a.user_id=(SELECT auth.uid()) AND a.active
          AND a.role IN ('owner','editor')
          AND (a.city=p.city OR (a.city='*' AND a.role='owner'))
      )
    )
  )
);

CREATE OR REPLACE FUNCTION public.review_community_post_with_reason(p_id uuid,p_approve boolean,p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_user uuid:=auth.uid(); v_author uuid; v_city text; v_status text; v_owner boolean;
BEGIN
 IF v_user IS NULL OR p_approve IS NULL THEN
  RAISE EXCEPTION 'Invalid moderator request' USING ERRCODE='42501';
 END IF;
 SELECT author_id,city,status INTO v_author,v_city,v_status
 FROM public.community_posts WHERE id=p_id FOR UPDATE;
 IF v_city IS NULL OR v_status<>'pending' THEN
  RAISE EXCEPTION 'Post unavailable for review' USING ERRCODE='42501';
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.city_admin_access a
  WHERE a.user_id=v_user AND a.active AND a.city='*' AND a.role='owner') INTO v_owner;
 IF NOT v_owner AND (v_author=v_user OR NOT EXISTS(
  SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active
  AND a.city=v_city AND a.role IN ('editor','owner')
 )) THEN RAISE EXCEPTION 'Not authorized for this city' USING ERRCODE='42501'; END IF;
 IF NOT p_approve AND (p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 1000) THEN
  RAISE EXCEPTION 'Rejection reason required (3-1000 characters)' USING ERRCODE='22023';
 END IF;
 IF NOT p_approve THEN
  INSERT INTO public.community_post_review_reasons(post_id,reason,reviewed_by,reviewed_at)
  VALUES(p_id,btrim(p_reason),v_user,now())
  ON CONFLICT(post_id) DO UPDATE
   SET reason=EXCLUDED.reason,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=EXCLUDED.reviewed_at;
 ELSE
  DELETE FROM public.community_post_review_reasons WHERE post_id=p_id;
 END IF;
 UPDATE public.community_posts SET status=CASE WHEN p_approve THEN 'published' ELSE 'rejected' END
 WHERE id=p_id;
END; $$;
REVOKE ALL ON FUNCTION public.review_community_post_with_reason(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_community_post_with_reason(uuid,boolean,text) TO authenticated;

-- Old callers can approve but cannot bypass the mandatory rejection reason.
CREATE OR REPLACE FUNCTION public.review_community_post(p_id uuid,p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.review_community_post_with_reason(p_id,p_approve,NULL);
END; $$;
REVOKE ALL ON FUNCTION public.review_community_post(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_community_post(uuid,boolean) TO authenticated;

-- Resident submissions always await review, including in future cities.
CREATE OR REPLACE FUNCTION public.community_submit_post(p_post_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 UPDATE public.community_posts SET status='pending'
 WHERE id=p_post_id AND author_id=auth.uid() AND status IN ('draft','rejected');
 IF NOT FOUND THEN RAISE EXCEPTION 'Post unavailable for submission' USING ERRCODE='42501'; END IF;
 RETURN 'pending';
END; $$;
REVOKE ALL ON FUNCTION public.community_submit_post(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.community_submit_post(uuid) TO authenticated;
