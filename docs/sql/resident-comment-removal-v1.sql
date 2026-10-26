-- Apply only after explicit approval. Preserve rows for the existing anti-spam quota.
BEGIN;
CREATE FUNCTION public.remove_own_community_comment(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 UPDATE public.community_comments SET status='archived',body='[Комментарий удалён автором]'
 WHERE id=p_id AND author_id=u;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.remove_own_community_comment(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_own_community_comment(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
