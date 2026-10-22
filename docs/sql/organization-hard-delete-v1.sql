-- Permanent deletion of one selected organization; never a bulk archive cleanup.
BEGIN;
CREATE OR REPLACE FUNCTION public.delete_organization(p_id text,p_city text,p_expected_updated_at timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor uuid:=auth.uid(); actual_city text; actual_updated_at timestamptz;
BEGIN
 IF actor IS NULL OR p_id IS NULL OR p_city IS NULL OR p_expected_updated_at IS NULL THEN
  RAISE EXCEPTION 'Organization deletion requires a current administrator session' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.city_admin_access a WHERE a.user_id=actor AND a.active
  AND ((a.city=p_city AND a.role IN ('owner','editor')) OR (a.city='*' AND a.role='owner'))) THEN
  RAISE EXCEPTION 'No permission to delete organizations in this city' USING ERRCODE='42501';
 END IF;
 SELECT city,updated_at INTO actual_city,actual_updated_at FROM public.organizations WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR actual_city IS DISTINCT FROM p_city OR actual_updated_at IS DISTINCT FROM p_expected_updated_at THEN
  RAISE EXCEPTION 'Organization changed; refresh before deleting' USING ERRCODE='40001';
 END IF;
 -- Preserve the applicant's decision history, including the approved status.
 UPDATE public.organization_applications SET organization_id=NULL WHERE organization_id=p_id;
 -- Existing review FK intentionally cascades for the organization being deleted.
 DELETE FROM public.organizations WHERE id=p_id;
 RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_organization(text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_organization(text,text,timestamptz) TO authenticated;
COMMIT;
