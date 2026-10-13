-- REVIEW DRAFT ONLY. Run manually in a disposable Supabase project first.
-- Never executed by CI, the importer or a frontend. Requires auth.users / auth.uid().
-- Existing profiles, favorites and Auth policies are intentionally untouched.
BEGIN;

CREATE TABLE public.organizations (
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,159}
  city text NOT NULL CHECK (length(city) <= 100 AND length(btrim(city)) > 0),
  title text NOT NULL CHECK (length(title) <= 160 AND length(btrim(title)) > 0),
  category text NOT NULL CHECK (length(category) <= 100 AND length(btrim(category)) > 0),
  description text NOT NULL CHECK (length(description) <= 2000 AND length(btrim(description)) > 0),
  address text CHECK (length(address) <= 300),
  phone text CHECK (length(phone) <= 40),
  hours text CHECK (length(hours) <= 300),
  website text CHECK (length(website) <= 500 AND website ~ '^https://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$'),
  vk_url text CHECK (length(vk_url) <= 500 AND vk_url ~ '^https://(www\.)?vk\.(com|ru)([/?#][^[:space:]]*)?$'),
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  source_type text NOT NULL CHECK (source_type IN ('user_provided', 'manual_verified', 'official_website', 'official_social', 'government_open_data')),
  source_url text CHECK (length(source_url) <= 500 AND source_url ~ '^https://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$'),
  verified_at date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (status <> 'published' OR verified_at IS NOT NULL)
);
-- Same identity strategy as the browser. Legacy IDs are preserved by the supplied seed.
CREATE UNIQUE INDEX organizations_identity ON public.organizations (
  lower(regexp_replace(btrim(city), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(title), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(coalesce(address, '')), '\s+', ' ', 'g'))
);
CREATE INDEX organizations_public_city ON public.organizations (city, id) WHERE status = 'published';

CREATE TABLE public.organization_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_request_id uuid NOT NULL,
  city text NOT NULL CHECK (length(city) <= 100 AND length(btrim(city)) > 0),
  title text NOT NULL CHECK (length(title) <= 160 AND length(btrim(title)) > 0),
  category text NOT NULL CHECK (length(category) <= 100 AND length(btrim(category)) > 0),
  address text NOT NULL CHECK (length(address) <= 300 AND length(btrim(address)) > 0),
  phone text NOT NULL DEFAULT '' CHECK (phone = '' OR phone ~ '^[+0-9\s().-]{5,40}$'),
  hours text NOT NULL DEFAULT '' CHECK (length(hours) <= 300),
  description text NOT NULL CHECK (length(description) <= 2000 AND length(btrim(description)) > 0),
  website text NOT NULL DEFAULT '' CHECK (website = '' OR (length(website) <= 500 AND website ~ '^https://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$')),
  vk_url text NOT NULL DEFAULT '' CHECK (vk_url = '' OR (length(vk_url) <= 500 AND vk_url ~ '^https://(www\.)?vk\.(com|ru)([/?#][^[:space:]]*)?$')),
  source_note text NOT NULL CHECK (length(source_note) <= 1000 AND length(btrim(source_note)) > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  consent_accepted boolean NOT NULL CHECK (consent_accepted = true),
  consent_version text NOT NULL CHECK (consent_version = 'ORG-APPLICATION-1.0'),
  consented_at timestamptz NOT NULL DEFAULT now(),
  review_message text CHECK (length(review_message) <= 1000),
  reviewed_at timestamptz,
  organization_id text REFERENCES public.organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (applicant_id, client_request_id),
  CHECK ((status = 'pending' AND reviewed_at IS NULL AND organization_id IS NULL AND review_message IS NULL)
      OR (status = 'rejected' AND reviewed_at IS NOT NULL AND organization_id IS NULL)
      OR (status = 'approved' AND reviewed_at IS NOT NULL AND organization_id IS NOT NULL))
);
CREATE INDEX organization_applications_owner ON public.organization_applications (applicant_id, created_at DESC, id);

CREATE FUNCTION public.organizations_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION public.organizations_set_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER organizations_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.organizations_set_updated_at();
CREATE TRIGGER organization_applications_updated BEFORE UPDATE ON public.organization_applications FOR EACH ROW EXECUTE FUNCTION public.organizations_set_updated_at();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_applications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.organizations, public.organization_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.organizations TO anon, authenticated;
GRANT SELECT ON public.organization_applications TO authenticated;
GRANT INSERT (applicant_id, client_request_id, title, city, category, address, phone, hours, description, website, vk_url, source_note, consent_accepted, consent_version)
  ON public.organization_applications TO authenticated;
GRANT ALL ON public.organizations, public.organization_applications TO service_role;
CREATE POLICY organizations_published ON public.organizations FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY applications_own ON public.organization_applications FOR SELECT TO authenticated USING (applicant_id = (SELECT auth.uid()));
CREATE POLICY applications_submit ON public.organization_applications FOR INSERT TO authenticated
  WITH CHECK (applicant_id = (SELECT auth.uid()) AND status = 'pending'
    AND consent_accepted = true AND consent_version = 'ORG-APPLICATION-1.0'
    AND reviewed_at IS NULL AND organization_id IS NULL AND review_message IS NULL);
-- No client UPDATE/DELETE policies, status-column INSERT grants or new admin roles.

-- Trusted moderation only: explicitly reviewed fields, not the applicant's untrusted payload.
-- SECURITY INVOKER + revoked execution prevents browser RPC calls or privilege escalation.
CREATE FUNCTION public.publish_organization_application(p_application_id uuid, p_organization_id text, p_reviewed_fields jsonb, p_message text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE pending_id uuid;
BEGIN
  SELECT id INTO pending_id FROM public.organization_applications WHERE id = p_application_id AND status = 'pending' FOR UPDATE;
  IF pending_id IS NULL THEN RAISE EXCEPTION 'Application missing or already reviewed'; END IF;
  IF p_reviewed_fields IS NULL OR jsonb_typeof(p_reviewed_fields) <> 'object'
      OR NOT (p_reviewed_fields ?& ARRAY['title','city','category','description','source_type','verified_at'])
      OR p_reviewed_fields->>'verified_at' IS NULL THEN RAISE EXCEPTION 'Reviewed fields and actual verification date are required'; END IF;
  IF (p_reviewed_fields->>'verified_at')::date > CURRENT_DATE THEN RAISE EXCEPTION 'Verification date cannot be in the future'; END IF;
  INSERT INTO public.organizations (id,title,city,category,description,address,phone,hours,website,vk_url,latitude,longitude,source_type,source_url,verified_at,status)
  VALUES (p_organization_id,p_reviewed_fields->>'title',p_reviewed_fields->>'city',p_reviewed_fields->>'category',p_reviewed_fields->>'description',
    nullif(p_reviewed_fields->>'address',''),nullif(p_reviewed_fields->>'phone',''),nullif(p_reviewed_fields->>'hours',''),
    nullif(p_reviewed_fields->>'website',''),nullif(p_reviewed_fields->>'vk_url',''),(p_reviewed_fields->>'latitude')::double precision,
    (p_reviewed_fields->>'longitude')::double precision,p_reviewed_fields->>'source_type',nullif(p_reviewed_fields->>'source_url',''),(p_reviewed_fields->>'verified_at')::date,'published')
  ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,city=EXCLUDED.city,category=EXCLUDED.category,description=EXCLUDED.description,
    address=EXCLUDED.address,phone=EXCLUDED.phone,hours=EXCLUDED.hours,website=EXCLUDED.website,vk_url=EXCLUDED.vk_url,
    latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,source_type=EXCLUDED.source_type,source_url=EXCLUDED.source_url,verified_at=EXCLUDED.verified_at,status='published';
  UPDATE public.organization_applications SET status='approved',reviewed_at=now(),organization_id=p_organization_id,review_message=p_message WHERE id=pending_id;
  RETURN p_organization_id;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_organization_application(uuid,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_organization_application(uuid,text,jsonb,text) TO service_role;
COMMIT;
),
  kind text NOT NULL DEFAULT 'places' CHECK (kind IN ('places', 'services')),
  city text NOT NULL CHECK (length(city) <= 100 AND length(btrim(city)) > 0),
  title text NOT NULL CHECK (length(title) <= 160 AND length(btrim(title)) > 0),
  category text NOT NULL CHECK (length(category) <= 100 AND length(btrim(category)) > 0),
  description text NOT NULL CHECK (length(description) <= 2000 AND length(btrim(description)) > 0),
  address text CHECK (length(address) <= 300),
  phone text CHECK (length(phone) <= 40),
  hours text CHECK (length(hours) <= 300),
  website text CHECK (length(website) <= 500 AND website ~ '^https://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$'),
  vk_url text CHECK (length(vk_url) <= 500 AND vk_url ~ '^https://(www\.)?vk\.(com|ru)([/?#][^[:space:]]*)?$'),
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  source_type text NOT NULL CHECK (source_type IN ('user_provided', 'manual_verified', 'official_website', 'official_social', 'government_open_data')),
  source_url text CHECK (length(source_url) <= 500 AND source_url ~ '^https://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$'),
  verified_at date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (status <> 'published' OR verified_at IS NOT NULL)
);
-- Same identity strategy as the browser. Legacy IDs are preserved by the supplied seed.
CREATE UNIQUE INDEX organizations_identity ON public.organizations (
  lower(regexp_replace(btrim(city), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(title), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(coalesce(address, '')), '\s+', ' ', 'g'))
);
CREATE INDEX organizations_public_city ON public.organizations (city, id) WHERE status = 'published';

CREATE TABLE public.organization_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_request_id uuid NOT NULL,
  city text NOT NULL CHECK (length(city) <= 100 AND length(btrim(city)) > 0),
  title text NOT NULL CHECK (length(title) <= 160 AND length(btrim(title)) > 0),
  category text NOT NULL CHECK (length(category) <= 100 AND length(btrim(category)) > 0),
  address text NOT NULL CHECK (length(address) <= 300 AND length(btrim(address)) > 0),
  phone text NOT NULL DEFAULT '' CHECK (phone = '' OR phone ~ '^[+0-9\s().-]{5,40}$'),
  hours text NOT NULL DEFAULT '' CHECK (length(hours) <= 300),
  description text NOT NULL CHECK (length(description) <= 2000 AND length(btrim(description)) > 0),
  website text NOT NULL DEFAULT '' CHECK (website = '' OR (length(website) <= 500 AND website ~ '^https://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$')),
  vk_url text NOT NULL DEFAULT '' CHECK (vk_url = '' OR (length(vk_url) <= 500 AND vk_url ~ '^https://(www\.)?vk\.(com|ru)([/?#][^[:space:]]*)?$')),
  source_note text NOT NULL CHECK (length(source_note) <= 1000 AND length(btrim(source_note)) > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  consent_accepted boolean NOT NULL CHECK (consent_accepted = true),
  consent_version text NOT NULL CHECK (consent_version = 'ORG-APPLICATION-1.0'),
  consented_at timestamptz NOT NULL DEFAULT now(),
  review_message text CHECK (length(review_message) <= 1000),
  reviewed_at timestamptz,
  organization_id text REFERENCES public.organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (applicant_id, client_request_id),
  CHECK ((status = 'pending' AND reviewed_at IS NULL AND organization_id IS NULL AND review_message IS NULL)
      OR (status = 'rejected' AND reviewed_at IS NOT NULL AND organization_id IS NULL)
      OR (status = 'approved' AND reviewed_at IS NOT NULL AND organization_id IS NOT NULL))
);
CREATE INDEX organization_applications_owner ON public.organization_applications (applicant_id, created_at DESC, id);

CREATE FUNCTION public.organizations_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION public.organizations_set_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER organizations_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.organizations_set_updated_at();
CREATE TRIGGER organization_applications_updated BEFORE UPDATE ON public.organization_applications FOR EACH ROW EXECUTE FUNCTION public.organizations_set_updated_at();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_applications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.organizations, public.organization_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.organizations TO anon, authenticated;
GRANT SELECT ON public.organization_applications TO authenticated;
GRANT INSERT (applicant_id, client_request_id, title, city, category, address, phone, hours, description, website, vk_url, source_note, consent_accepted, consent_version)
  ON public.organization_applications TO authenticated;
GRANT ALL ON public.organizations, public.organization_applications TO service_role;
CREATE POLICY organizations_published ON public.organizations FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY applications_own ON public.organization_applications FOR SELECT TO authenticated USING (applicant_id = (SELECT auth.uid()));
CREATE POLICY applications_submit ON public.organization_applications FOR INSERT TO authenticated
  WITH CHECK (applicant_id = (SELECT auth.uid()) AND status = 'pending'
    AND consent_accepted = true AND consent_version = 'ORG-APPLICATION-1.0'
    AND reviewed_at IS NULL AND organization_id IS NULL AND review_message IS NULL);
-- No client UPDATE/DELETE policies, status-column INSERT grants or new admin roles.

-- Trusted moderation only: explicitly reviewed fields, not the applicant's untrusted payload.
-- SECURITY INVOKER + revoked execution prevents browser RPC calls or privilege escalation.
CREATE FUNCTION public.publish_organization_application(p_application_id uuid, p_organization_id text, p_reviewed_fields jsonb, p_message text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE pending_id uuid;
BEGIN
  SELECT id INTO pending_id FROM public.organization_applications WHERE id = p_application_id AND status = 'pending' FOR UPDATE;
  IF pending_id IS NULL THEN RAISE EXCEPTION 'Application missing or already reviewed'; END IF;
  IF p_reviewed_fields IS NULL OR jsonb_typeof(p_reviewed_fields) <> 'object'
      OR NOT (p_reviewed_fields ?& ARRAY['title','city','category','description','source_type','verified_at'])
      OR p_reviewed_fields->>'verified_at' IS NULL THEN RAISE EXCEPTION 'Reviewed fields and actual verification date are required'; END IF;
  IF (p_reviewed_fields->>'verified_at')::date > CURRENT_DATE THEN RAISE EXCEPTION 'Verification date cannot be in the future'; END IF;
  INSERT INTO public.organizations (id,title,city,category,description,address,phone,hours,website,vk_url,latitude,longitude,source_type,source_url,verified_at,status)
  VALUES (p_organization_id,p_reviewed_fields->>'title',p_reviewed_fields->>'city',p_reviewed_fields->>'category',p_reviewed_fields->>'description',
    nullif(p_reviewed_fields->>'address',''),nullif(p_reviewed_fields->>'phone',''),nullif(p_reviewed_fields->>'hours',''),
    nullif(p_reviewed_fields->>'website',''),nullif(p_reviewed_fields->>'vk_url',''),(p_reviewed_fields->>'latitude')::double precision,
    (p_reviewed_fields->>'longitude')::double precision,p_reviewed_fields->>'source_type',nullif(p_reviewed_fields->>'source_url',''),(p_reviewed_fields->>'verified_at')::date,'published')
  ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,city=EXCLUDED.city,category=EXCLUDED.category,description=EXCLUDED.description,
    address=EXCLUDED.address,phone=EXCLUDED.phone,hours=EXCLUDED.hours,website=EXCLUDED.website,vk_url=EXCLUDED.vk_url,
    latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,source_type=EXCLUDED.source_type,source_url=EXCLUDED.source_url,verified_at=EXCLUDED.verified_at,status='published';
  UPDATE public.organization_applications SET status='approved',reviewed_at=now(),organization_id=p_organization_id,review_message=p_message WHERE id=pending_id;
  RETURN p_organization_id;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_organization_application(uuid,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_organization_application(uuid,text,jsonb,text) TO service_role;
COMMIT;
