-- Ryadom closed beta: explain rejected classifieds and preserve moderator audit.
-- Apply first to Ryadom-Test, never to production before backup restore rehearsal
-- and real-account acceptance testing. This adds no public access to private data.
ALTER TABLE public.classifieds
  ADD COLUMN rejection_reason text;
ALTER TABLE public.classifieds
  ADD CONSTRAINT classified_rejection_reason_length
    CHECK (rejection_reason IS NULL OR char_length(btrim(rejection_reason)) BETWEEN 10 AND 500);
GRANT SELECT (rejection_reason) ON public.classifieds TO authenticated;
-- Do not grant UPDATE(rejection_reason): only a verified moderator may set it.

CREATE TABLE public.classified_moderation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.classifieds(id) ON DELETE CASCADE,
  city text NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  moderator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) BETWEEN 10 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX classified_moderation_history_listing
  ON public.classified_moderation_history(listing_id,created_at DESC);
ALTER TABLE public.classified_moderation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classified_moderation_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.classified_moderation_history FROM PUBLIC,anon,authenticated;
GRANT SELECT (id,listing_id,city,author_id,moderator_id,decision,reason,created_at)
  ON public.classified_moderation_history TO authenticated;
CREATE POLICY classified_moderation_history_visible
  ON public.classified_moderation_history FOR SELECT TO authenticated
  USING (
    author_id=(SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.city_admin_access access
      WHERE access.user_id=(SELECT auth.uid()) AND access.active
        AND (access.city=classified_moderation_history.city
             OR (access.city='*' AND access.role='owner'))
    )
  );
-- A subsequent author edit/resubmission clears the active reason; history remains.
CREATE FUNCTION public.classified_clear_rejection_on_resubmit()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'rejected' AND OLD.status IS DISTINCT FROM NEW.status
  THEN NEW.rejection_reason = NULL; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER classified_clear_rejection_on_resubmit
  BEFORE UPDATE OF status ON public.classifieds FOR EACH ROW
  EXECUTE FUNCTION public.classified_clear_rejection_on_resubmit();
REVOKE ALL ON FUNCTION public.classified_clear_rejection_on_resubmit() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.review_classified_with_reason(
  p_listing_id uuid, p_approve boolean, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_city text; v_author uuid; v_status text; v_user uuid := auth.uid();
  v_reason text := NULLIF(btrim(p_reason),'');
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
  IF v_author=v_user OR NOT EXISTS (
    SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active
      AND (a.city=v_city OR (a.city='*' AND a.role='owner'))
  ) THEN RAISE EXCEPTION 'Not authorized to review this listing' USING ERRCODE='42501'; END IF;
  UPDATE public.classifieds SET
    status=CASE WHEN p_approve THEN 'published' ELSE 'rejected' END,
    rejection_reason=v_reason
    WHERE id=p_listing_id;
  INSERT INTO public.classified_moderation_history
    (listing_id,city,author_id,moderator_id,decision,reason)
    VALUES (p_listing_id,v_city,v_author,v_user,
      CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,v_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.review_classified_with_reason(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_classified_with_reason(uuid,boolean,text) TO authenticated;

-- Retain the old two-parameter approval contract, but reject reasonless rejections.
CREATE OR REPLACE FUNCTION public.review_classified(p_listing_id uuid,p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_approve IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Rejection reason required' USING ERRCODE='22023';
  END IF;
  PERFORM public.review_classified_with_reason(p_listing_id,true,NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.review_classified(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_classified(uuid,boolean) TO authenticated;
