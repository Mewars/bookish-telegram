-- Ryadom-Test only. Never enable for real location data before the privacy gate.
-- One approximate current point, no movement history; no coordinates in public tables.
BEGIN;
CREATE SCHEMA IF NOT EXISTS nearby_private;
REVOKE ALL ON SCHEMA nearby_private FROM PUBLIC,anon,service_role;
GRANT USAGE ON SCHEMA nearby_private TO authenticated;
CREATE TABLE IF NOT EXISTS nearby_private.profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 display_name text NOT NULL DEFAULT 'Друг' CHECK(char_length(display_name) BETWEEN 2 AND 40),
 invite_code text UNIQUE,invite_expires timestamptz,
 requests_started timestamptz NOT NULL DEFAULT now(),requests_count integer NOT NULL DEFAULT 0,
 location_token uuid,token_expires timestamptz
);
CREATE TABLE IF NOT EXISTS nearby_private.friendships (
 first_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 second_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 accepted boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(first_id,second_id),CHECK(first_id<second_id),CHECK(requester_id IN(first_id,second_id))
);
CREATE INDEX IF NOT EXISTS nearby_friendships_second ON nearby_private.friendships(second_id);
CREATE INDEX IF NOT EXISTS nearby_friendships_requester ON nearby_private.friendships(requester_id);
CREATE TABLE IF NOT EXISTS nearby_private.blocks (
 blocker_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 blocked_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 PRIMARY KEY(blocker_id,blocked_id),CHECK(blocker_id<>blocked_id)
);
CREATE TABLE IF NOT EXISTS nearby_private.locations (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 latitude numeric NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude numeric NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 updated_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS nearby_blocks_blocked ON nearby_private.blocks(blocked_id);
CREATE INDEX IF NOT EXISTS nearby_locations_expiry ON nearby_private.locations(expires_at);
ALTER TABLE nearby_private.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearby_private.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE nearby_private.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearby_private.friendships FORCE ROW LEVEL SECURITY;
ALTER TABLE nearby_private.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearby_private.blocks FORCE ROW LEVEL SECURITY;
ALTER TABLE nearby_private.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearby_private.locations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA nearby_private FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION nearby_private.nearby_state() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); result jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 -- Expiry is enforced by every read regardless of cleanup timing.
 DELETE FROM nearby_private.locations WHERE expires_at<=now();
 SELECT jsonb_build_object(
 'self',jsonb_build_object('display_name',coalesce(p.display_name,'Друг'),
  'invite_code',CASE WHEN p.invite_expires>now() THEN p.invite_code END,
  'invite_expires',CASE WHEN p.invite_expires>now() THEN p.invite_expires END,
  'latitude',l.latitude,'longitude',l.longitude,'expires_at',l.expires_at),
 'friends',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',other.user_id,'name',other.display_name,'accepted',f.accepted,
   'incoming',f.requester_id<>u,'latitude',loc.latitude,'longitude',loc.longitude,
   'updated_at',loc.updated_at,'expires_at',loc.expires_at) ORDER BY f.created_at)
  FROM nearby_private.friendships f
  JOIN nearby_private.profiles other ON other.user_id=CASE WHEN f.first_id=u THEN f.second_id ELSE f.first_id END
  LEFT JOIN nearby_private.locations loc ON loc.user_id=other.user_id AND f.accepted AND loc.expires_at>now()
  WHERE (f.first_id=u OR f.second_id=u) AND NOT EXISTS(
   SELECT 1 FROM nearby_private.blocks b WHERE (b.blocker_id=u AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=u))),'[]'::jsonb),
 'blocked',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.blocked_id,'name',coalesce(bp.display_name,'Друг')))
   FROM nearby_private.blocks b LEFT JOIN nearby_private.profiles bp ON bp.user_id=b.blocked_id WHERE b.blocker_id=u),'[]'::jsonb))
 INTO result FROM (SELECT u AS id) me
 LEFT JOIN nearby_private.profiles p ON p.user_id=me.id
 LEFT JOIN nearby_private.locations l ON l.user_id=me.id AND l.expires_at>now();
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION nearby_private.nearby_invite(p_name text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); code text:=replace(gen_random_uuid()::text,'-','');
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 40 THEN
  RAISE EXCEPTION 'Name must be between 2 and 40 characters' USING ERRCODE='22023'; END IF;
 INSERT INTO nearby_private.profiles(user_id,display_name,invite_code,invite_expires)
 VALUES(u,btrim(p_name),code,now()+interval '24 hours') ON CONFLICT(user_id) DO UPDATE
 SET display_name=excluded.display_name,invite_code=excluded.invite_code,invite_expires=excluded.invite_expires;
 RETURN code;
END $$;

CREATE OR REPLACE FUNCTION nearby_private.nearby_request(p_code text,p_name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); peer uuid; first_user uuid; second_user uuid; counter nearby_private.profiles;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 40 THEN
  RAISE EXCEPTION 'Name must be between 2 and 40 characters' USING ERRCODE='22023'; END IF;
 IF p_code IS NULL OR lower(btrim(p_code)) !~ '^[a-f0-9]{32}$' THEN
  RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,85));
 SELECT user_id INTO peer FROM nearby_private.profiles WHERE invite_code=lower(btrim(p_code)) AND invite_expires>now();
 IF peer IS NULL OR peer=u THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501'; END IF;
 -- Serialize all mutations for this pair, including simultaneous blocking.
 first_user:=least(u,peer); second_user:=greatest(u,peer);
 PERFORM pg_advisory_xact_lock(hashtextextended(first_user::text||second_user::text,86));
 IF EXISTS(SELECT 1 FROM nearby_private.blocks WHERE (blocker_id=u AND blocked_id=peer) OR (blocker_id=peer AND blocked_id=u)) THEN
  RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501'; END IF;
 INSERT INTO nearby_private.profiles(user_id,display_name) VALUES(u,btrim(p_name)) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name;
 IF EXISTS(SELECT 1 FROM nearby_private.friendships WHERE first_id=first_user AND second_id=second_user) THEN RETURN; END IF;
 SELECT * INTO counter FROM nearby_private.profiles WHERE user_id=u FOR UPDATE;
 IF counter.requests_started<=now()-interval '24 hours' THEN
  UPDATE nearby_private.profiles SET requests_started=now(),requests_count=0 WHERE user_id=u;
 ELSIF counter.requests_count>=10 THEN RAISE EXCEPTION 'Invitation limit reached' USING ERRCODE='54000'; END IF;
 UPDATE nearby_private.profiles SET requests_count=requests_count+1 WHERE user_id=u;
 INSERT INTO nearby_private.friendships(first_id,second_id,requester_id) VALUES(first_user,second_user,u);
END $$;

CREATE OR REPLACE FUNCTION nearby_private.nearby_respond(p_peer uuid,p_accept boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL OR p_peer IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(least(u,p_peer)::text||greatest(u,p_peer)::text,86));
 IF p_accept IS NULL THEN RAISE EXCEPTION 'Invalid response' USING ERRCODE='22023'; END IF;
 IF p_accept THEN
  UPDATE nearby_private.friendships SET accepted=true WHERE first_id=least(u,p_peer) AND second_id=greatest(u,p_peer) AND requester_id<>u AND NOT accepted;
 ELSE
  DELETE FROM nearby_private.friendships WHERE first_id=least(u,p_peer) AND second_id=greatest(u,p_peer) AND requester_id<>u AND NOT accepted;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
END $$;

CREATE OR REPLACE FUNCTION nearby_private.nearby_disconnect(p_peer uuid,p_block boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL OR p_peer IS NULL OR p_peer=u OR p_block IS NULL THEN RAISE EXCEPTION 'Invalid participant' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(least(u,p_peer)::text||greatest(u,p_peer)::text,86));
 IF p_block AND NOT EXISTS(SELECT 1 FROM nearby_private.friendships WHERE first_id=least(u,p_peer) AND second_id=greatest(u,p_peer))
  AND NOT EXISTS(SELECT 1 FROM nearby_private.blocks WHERE blocker_id=u AND blocked_id=p_peer) THEN
  RAISE EXCEPTION 'Friend unavailable' USING ERRCODE='42501'; END IF;
 DELETE FROM nearby_private.friendships WHERE first_id=least(u,p_peer) AND second_id=greatest(u,p_peer);
 IF p_block THEN INSERT INTO nearby_private.blocks VALUES(u,p_peer) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM nearby_private.blocks WHERE blocker_id=u AND blocked_id=p_peer;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION nearby_private.nearby_start_sharing() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); token uuid:=gen_random_uuid();
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 INSERT INTO nearby_private.profiles(user_id,location_token,token_expires) VALUES(u,token,now()+interval '10 minutes')
 ON CONFLICT(user_id) DO UPDATE SET location_token=excluded.location_token,token_expires=excluded.token_expires;
 DELETE FROM nearby_private.locations WHERE user_id=u;
 RETURN token;
END $$;

CREATE OR REPLACE FUNCTION nearby_private.nearby_share(p_lat double precision,p_lon double precision,p_token uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); permitted uuid;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_lat IS NULL OR p_lon IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lon NOT BETWEEN -180 AND 180 THEN
  RAISE EXCEPTION 'Invalid coordinates' USING ERRCODE='22023'; END IF;
 -- Same row lock as hide/start: a delayed GPS response cannot undo revocation.
 SELECT location_token INTO permitted FROM nearby_private.profiles WHERE user_id=u AND token_expires>now() FOR UPDATE;
 IF permitted IS NULL OR p_token IS NULL OR permitted<>p_token THEN RAISE EXCEPTION 'Sharing consent expired' USING ERRCODE='42501'; END IF;
 INSERT INTO nearby_private.locations(user_id,latitude,longitude,expires_at)
 VALUES(u,round(p_lat::numeric,2),round(p_lon::numeric,2),now()+interval '1 hour')
 ON CONFLICT(user_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,updated_at=now(),expires_at=excluded.expires_at;
 -- A consent token authorizes exactly one fix, not continuous tracking.
 UPDATE nearby_private.profiles SET location_token=NULL,token_expires=NULL WHERE user_id=u;
END $$;

CREATE OR REPLACE FUNCTION nearby_private.nearby_hide() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 UPDATE nearby_private.profiles SET location_token=NULL,token_expires=NULL WHERE user_id=u;
 DELETE FROM nearby_private.locations WHERE user_id=u;
END $$;

-- Only invoker wrappers are exposed in public. All privileged code stays private.
CREATE OR REPLACE FUNCTION public.nearby_state() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT nearby_private.nearby_state()$$;
CREATE OR REPLACE FUNCTION public.nearby_invite(p_name text) RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT nearby_private.nearby_invite(p_name)$$;
CREATE OR REPLACE FUNCTION public.nearby_request(p_code text,p_name text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT nearby_private.nearby_request(p_code,p_name)$$;
CREATE OR REPLACE FUNCTION public.nearby_respond(p_peer uuid,p_accept boolean) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT nearby_private.nearby_respond(p_peer,p_accept)$$;
CREATE OR REPLACE FUNCTION public.nearby_disconnect(p_peer uuid,p_block boolean) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT nearby_private.nearby_disconnect(p_peer,p_block)$$;
CREATE OR REPLACE FUNCTION public.nearby_start_sharing() RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT nearby_private.nearby_start_sharing()$$;
CREATE OR REPLACE FUNCTION public.nearby_share(p_lat double precision,p_lon double precision,p_token uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT nearby_private.nearby_share(p_lat,p_lon,p_token)$$;
CREATE OR REPLACE FUNCTION public.nearby_hide() RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT nearby_private.nearby_hide()$$;
DO $$DECLARE item record; BEGIN
 FOR item IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('public','nearby_private') AND p.proname IN('nearby_state','nearby_invite','nearby_request','nearby_respond','nearby_disconnect','nearby_start_sharing','nearby_share','nearby_hide') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',item.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',item.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
