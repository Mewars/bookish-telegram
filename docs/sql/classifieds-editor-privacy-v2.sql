-- Harden premoderation confidentiality: city editors may review submitted
-- entries but should never see unsubmitted drafts or private rejected edits.
-- Apply on Ryadom-Test only until release prerequisites are complete.
DROP POLICY IF EXISTS classifieds_editor_read ON public.classifieds;
CREATE POLICY classifieds_editor_read ON public.classifieds
FOR SELECT TO authenticated
USING (
  status='pending' AND EXISTS (
    SELECT 1 FROM public.city_admin_access a
    WHERE a.user_id=(SELECT auth.uid()) AND a.active
    AND (a.city=classifieds.city OR (a.city='*' AND a.role='owner'))
  )
);
