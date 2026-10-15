-- Ryadom-Test only. Deploy after community-feed-v1.sql; do not apply to production.
-- Archive an author's own post or question. Published comments become invisible
-- to the public under the existing RLS policies, without deleting audit records.
CREATE OR REPLACE FUNCTION public.archive_community_post(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_author uuid;
  v_type text;
  v_status text;
BEGIN
  IF v_user IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'Invalid archive request' USING ERRCODE='42501';
  END IF;
  SELECT author_id,post_type,status INTO v_author,v_type,v_status
    FROM public.community_posts WHERE id=p_id FOR UPDATE;
  IF v_author IS DISTINCT FROM v_user
    OR v_type NOT IN ('post','question')
    OR v_status NOT IN ('draft','pending','published','rejected')
  THEN
    RAISE EXCEPTION 'Post unavailable for withdrawal' USING ERRCODE='42501';
  END IF;
  UPDATE public.community_posts SET status='archived' WHERE id=p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.archive_community_post(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.archive_community_post(uuid) TO authenticated;
