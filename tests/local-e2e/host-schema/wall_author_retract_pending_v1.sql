-- Local integration fixture, copied from Production migration wall_author_retract_pending_v1.
-- Never apply this historical fixture to a hosted project.
CREATE OR REPLACE FUNCTION public.community_retract_pending_post(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE v_uid uuid:=auth.uid();
BEGIN
 IF v_uid IS NULL OR p_id IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 UPDATE public.community_posts SET status='draft' WHERE id=p_id AND author_id=v_uid AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Only your pending post can be returned to drafts' USING ERRCODE='42501'; END IF;
END;$f$;
REVOKE ALL ON FUNCTION public.community_retract_pending_post(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_retract_pending_post(uuid) TO authenticated;
