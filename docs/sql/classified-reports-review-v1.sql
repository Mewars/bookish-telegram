-- Ryadom-Test only: moderation of user reports and safe listing archival.
-- Safe additive migration: does not touch existing messages or user sessions.
ALTER TABLE public.classified_reports
  ADD COLUMN state text NOT NULL DEFAULT 'open'
    CHECK (state IN ('open','dismissed','action_taken')),
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id);
GRANT SELECT (state,reviewed_at) ON public.classified_reports TO authenticated;

-- Moderators can see reports for assigned cities without seeing private chats.
CREATE POLICY classified_reports_city_moderation_read
ON public.classified_reports FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.classifieds l
  JOIN public.city_admin_access a
    ON a.user_id=(SELECT auth.uid()) AND a.active
    AND (a.city=l.city OR (a.city='*' AND a.role='owner'))
  WHERE l.id=listing_id
));

CREATE FUNCTION public.review_classified_report(p_report_id uuid,p_hide_listing boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_listing uuid;
  v_city text;
  v_owner uuid;
  v_reporter uuid;
  v_state text;
  v_status text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';
  END IF;

  SELECT r.listing_id,r.reporter_id,r.state,l.city,l.author_id,l.status
    INTO v_listing,v_reporter,v_state,v_city,v_owner,v_status
    FROM public.classified_reports r
    JOIN public.classifieds l ON l.id=r.listing_id
    WHERE r.id=p_report_id FOR UPDATE OF r;

  IF v_listing IS NULL OR v_state <> 'open' THEN
    RAISE EXCEPTION 'Report unavailable for review' USING ERRCODE='42501';
  END IF;
  IF v_owner=v_actor OR v_reporter=v_actor OR NOT EXISTS (
    SELECT 1 FROM public.city_admin_access a
      WHERE a.user_id=v_actor AND a.active
        AND (a.city=v_city OR (a.city='*' AND a.role='owner'))
  ) THEN
    RAISE EXCEPTION 'Not authorized for this city' USING ERRCODE='42501';
  END IF;
  IF p_hide_listing IS NULL THEN
    RAISE EXCEPTION 'Invalid review action' USING ERRCODE='22023';
  END IF;
  IF p_hide_listing AND v_status NOT IN ('published','completed') THEN
    RAISE EXCEPTION 'Listing is not public' USING ERRCODE='42501';
  END IF;

  IF p_hide_listing THEN
    UPDATE public.classifieds SET status='archived' WHERE id=v_listing;
    -- Once the listing is hidden, resolve every outstanding report on it
    -- so staff do not end up with inaccessible reports for archived content.
    UPDATE public.classified_reports
      SET state='action_taken',reviewed_by=v_actor,reviewed_at=now()
      WHERE listing_id=v_listing AND state='open';
  ELSE
    UPDATE public.classified_reports
      SET state='dismissed',reviewed_by=v_actor,reviewed_at=now()
      WHERE id=p_report_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.review_classified_report(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_classified_report(uuid,boolean) TO authenticated;
