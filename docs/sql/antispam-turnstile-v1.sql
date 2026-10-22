-- Install disabled; activate only after real Turnstile keys and both clients are ready.
BEGIN;
CREATE SCHEMA IF NOT EXISTS antispam_private;
REVOKE ALL ON SCHEMA antispam_private FROM PUBLIC,anon,authenticated;
CREATE TABLE antispam_private.settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 auth_enabled boolean NOT NULL DEFAULT false,content_enabled boolean NOT NULL DEFAULT false,
 site_key text,
 CHECK(NOT (auth_enabled OR content_enabled) OR (site_key IS NOT NULL AND site_key ~ '^[A-Za-z0-9_-]{10,100}$' AND site_key !~ '^[123]x0'))
);
INSERT INTO antispam_private.settings(singleton) VALUES(true);
CREATE TABLE antispam_private.permits(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 action text NOT NULL CHECK(action IN ('classified','wall_post','wall_comment','organization')),
 resource_id text,can_create boolean NOT NULL,can_submit boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes'
);
CREATE INDEX ON antispam_private.permits(user_id,action,expires_at);
ALTER TABLE antispam_private.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE antispam_private.permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA antispam_private FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.antispam_public_config() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT jsonb_build_object('auth_enabled',auth_enabled,'content_enabled',content_enabled,'site_key',site_key) FROM antispam_private.settings WHERE singleton $$;
REVOKE ALL ON FUNCTION public.antispam_public_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.antispam_public_config() TO anon,authenticated,service_role;
-- Only the Edge Function, after validating JWT and Siteverify, can issue permits.
CREATE FUNCTION public.antispam_grant(p_user_id uuid,p_action text,p_resource_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF p_user_id IS NULL OR p_action NOT IN ('classified','wall_post','wall_comment','organization') OR length(p_resource_id)>160 THEN
  RAISE EXCEPTION 'Invalid verification request' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 DELETE FROM antispam_private.permits WHERE user_id=p_user_id AND expires_at<now()-interval '1 hour';
 IF (SELECT count(*) FROM antispam_private.permits WHERE user_id=p_user_id AND created_at>now()-interval '15 minutes')>=30 THEN
  RAISE EXCEPTION 'Too many verification requests' USING ERRCODE='54000';
 END IF;
 INSERT INTO antispam_private.permits(user_id,action,resource_id,can_create,can_submit)
 VALUES(p_user_id,p_action,p_resource_id,p_resource_id IS NULL,p_action IN ('classified','wall_post'));
END;
$$;
REVOKE ALL ON FUNCTION public.antispam_grant(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.antispam_grant(uuid,text,text) TO service_role;
CREATE FUNCTION antispam_private.guard_content() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor uuid:=auth.uid(); permit_id uuid; submitting boolean:=TG_OP='UPDATE'; action_name text:=TG_ARGV[0];
BEGIN
 IF NOT (SELECT content_enabled FROM antispam_private.settings WHERE singleton) THEN RETURN NEW; END IF;
 IF submitting AND (NEW.status<>'pending' OR OLD.status=NEW.status) THEN RETURN NEW; END IF;
 -- Official staff news is a separate, already-authorized server operation.
 IF TG_TABLE_NAME='community_posts' THEN
  IF NEW.post_type='news' THEN RETURN NEW; END IF;
 END IF;
 -- Database maintenance without a user JWT remains possible; public API writes still require existing RLS/RPC authorization.
 IF actor IS NULL THEN
  IF session_user IN ('postgres','supabase_admin') AND current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'anon' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
 END IF;
 SELECT id INTO permit_id FROM antispam_private.permits
 WHERE user_id=actor AND action=action_name AND expires_at>now()
 AND CASE WHEN submitting THEN can_submit AND (resource_id IS NULL OR resource_id=NEW.id::text)
          ELSE can_create AND resource_id IS NULL END
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF permit_id IS NULL THEN RAISE EXCEPTION 'Подтвердите, что вы не робот, и повторите отправку.' USING ERRCODE='42501'; END IF;
 UPDATE antispam_private.permits SET resource_id=NEW.id::text,
  can_create=false,
  can_submit=CASE WHEN submitting THEN false ELSE can_submit END WHERE id=permit_id;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION antispam_private.guard_content() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER antispam_classified BEFORE INSERT OR UPDATE OF status ON public.classifieds FOR EACH ROW EXECUTE FUNCTION antispam_private.guard_content('classified');
CREATE TRIGGER antispam_wall_post BEFORE INSERT OR UPDATE OF status ON public.community_posts FOR EACH ROW EXECUTE FUNCTION antispam_private.guard_content('wall_post');
CREATE TRIGGER antispam_wall_comment BEFORE INSERT ON public.community_comments FOR EACH ROW EXECUTE FUNCTION antispam_private.guard_content('wall_comment');
CREATE TRIGGER antispam_organization BEFORE INSERT ON public.organization_applications FOR EACH ROW EXECUTE FUNCTION antispam_private.guard_content('organization');
COMMIT;
