-- Prepared for review. Do not apply to a hosted project without owner approval.
BEGIN;
CREATE TABLE public.classified_owner_pins (
 listing_id uuid PRIMARY KEY REFERENCES public.classifieds(id) ON DELETE CASCADE,
 pinned_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.classified_owner_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.classified_owner_pins FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.classified_owner_pins TO anon,authenticated;
CREATE POLICY classified_pins_public_published ON public.classified_owner_pins
 FOR SELECT TO anon,authenticated USING (EXISTS (
  SELECT 1 FROM public.classifieds c WHERE c.id=listing_id AND c.status='published'
 ));
CREATE OR REPLACE FUNCTION public.owner_pin_classified(p_id uuid,p_pin boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR p_pin IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.city_admin_access a WHERE a.user_id=actor AND a.active AND a.role='owner' AND a.city='*'
 ) THEN RAISE EXCEPTION 'Only platform owner may pin classifieds' USING ERRCODE='42501'; END IF;
 IF p_pin THEN
  -- Lock the listing so a concurrent withdrawal cannot race the published check.
  PERFORM 1 FROM public.classifieds WHERE id=p_id AND status='published' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Published classified not found' USING ERRCODE='42501'; END IF;
  INSERT INTO public.classified_owner_pins(listing_id) VALUES(p_id)
   ON CONFLICT(listing_id) DO UPDATE SET pinned_at=now();
 ELSE
  DELETE FROM public.classified_owner_pins WHERE listing_id=p_id;
 END IF;
 RETURN p_pin;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_pin_classified(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_pin_classified(uuid,boolean) TO authenticated;
COMMIT;
