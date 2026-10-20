-- Prepared patch: validate in isolation, then apply only with owner approval.
-- No policy expansion: published content still cannot be directly edited.
-- A narrowly scoped privileged operation is needed because RLS deliberately
-- prohibits UPDATE of published rows, even for their author.
CREATE OR REPLACE FUNCTION public.begin_classified_revision(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';
  END IF;
  UPDATE public.classifieds SET status='draft'
    WHERE id=p_listing_id AND author_id=v_user AND status='published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing unavailable for revision' USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_classified_revision(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_classified_revision(uuid) TO authenticated;

-- Preserve the existing production rule (read from Production 2026-10-20):
-- only the active global owner may review their own submitted listing.
-- City staff cannot approve themselves or work outside their assigned city.
CREATE OR REPLACE FUNCTION public.review_classified_with_reason(
  p_listing_id uuid,p_approve boolean,p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_city text; v_author uuid; v_status text; v_user uuid := auth.uid();
  v_reason text := NULLIF(btrim(p_reason),'');
  v_is_platform_owner boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  IF p_approve IS NULL THEN RAISE EXCEPTION 'Decision required' USING ERRCODE='22023'; END IF;
  IF NOT p_approve AND (v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 10 AND 500)
  THEN RAISE EXCEPTION 'Rejection reason must be between 10 and 500 characters' USING ERRCODE='22023'; END IF;
  IF p_approve THEN v_reason := NULL; END IF;
  SELECT city,author_id,status INTO v_city,v_author,v_status
    FROM public.classifieds WHERE id=p_listing_id FOR UPDATE;
  IF v_city IS NULL OR v_status <> 'pending'
  THEN RAISE EXCEPTION 'Listing is not pending review' USING ERRCODE='42501'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.city_admin_access a
    WHERE a.user_id=v_user AND a.active AND a.city='*' AND a.role='owner')
    INTO v_is_platform_owner;
  IF NOT v_is_platform_owner AND (v_author=v_user OR NOT EXISTS (
    SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active
      AND a.city=v_city AND a.role IN ('editor','owner')))
  THEN RAISE EXCEPTION 'Not authorized to review this listing' USING ERRCODE='42501'; END IF;
  UPDATE public.classifieds SET
    status=CASE WHEN p_approve THEN 'published' ELSE 'rejected' END,
    rejection_reason=v_reason WHERE id=p_listing_id;
  INSERT INTO public.classified_moderation_history
    (listing_id,city,author_id,moderator_id,decision,reason)
    VALUES (p_listing_id,v_city,v_author,v_user,
      CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,v_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.review_classified_with_reason(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_classified_with_reason(uuid,boolean,text) TO authenticated;
