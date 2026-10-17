-- Closed beta only. Apply after classifieds-private-messaging-v1 and the existing
-- classified migrations on Ryadom-Test. Do not apply to production without
-- tested backups, privacy review and an explicit release decision.
--
-- Removing an owner's published/completed listing is a one-way archival action.
-- Existing private conversations are retained, but send_classified_message
-- rejects archived listings. Previously issued signed photo URLs may still
-- work until their 600-second expiry.
CREATE FUNCTION public.archive_classified(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';
  END IF;

  UPDATE public.classifieds
     SET status = 'archived'
   WHERE id = p_listing_id
     AND author_id = auth.uid()
     AND status IN ('published', 'completed');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing unavailable for archiving' USING ERRCODE='42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_classified(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_classified(uuid) TO authenticated;
