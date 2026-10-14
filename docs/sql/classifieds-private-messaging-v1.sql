-- «РЯДОМ»: объявления и приватные сообщения. ТОЛЬКО Ryadom-Test на первом этапе.
-- Никогда не запускать на production до тестов RLS и восстановления бэкапа.
-- Совместимо с действующими auth.users, city_directory и city_admin_access.

CREATE TABLE public.classifieds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL REFERENCES public.city_directory(name),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_type text NOT NULL CHECK (deal_type IN ('sell','buy','rent_out','rent_in')),
  category text NOT NULL CHECK (length(btrim(category)) BETWEEN 2 AND 80),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 140),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 15 AND 4000),
  district text NOT NULL DEFAULT '' CHECK (length(district) <= 100),
  price_rub numeric(12,2) CHECK (price_rub IS NULL OR price_rub BETWEEN 0 AND 999999999.99),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published','rejected','archived','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX classifieds_public_city_created ON public.classifieds(city, created_at DESC) WHERE status IN ('published','completed');
CREATE INDEX classifieds_author_created ON public.classifieds(author_id, created_at DESC);
CREATE INDEX classifieds_pending_city ON public.classifieds(city, created_at) WHERE status='pending';

CREATE FUNCTION public.classifieds_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER classified_touch BEFORE UPDATE ON public.classifieds
FOR EACH ROW EXECUTE FUNCTION public.classifieds_touch_updated_at();
REVOKE ALL ON FUNCTION public.classifieds_touch_updated_at() FROM PUBLIC;

CREATE TABLE public.classified_user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE public.classified_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.classifieds(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id,buyer_id),
  CHECK (buyer_id <> seller_id)
);
CREATE INDEX classified_conversations_seller ON public.classified_conversations(seller_id,created_at DESC);
CREATE INDEX classified_conversations_buyer ON public.classified_conversations(buyer_id,created_at DESC);

CREATE TABLE public.classified_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.classified_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX classified_messages_thread ON public.classified_messages(conversation_id,created_at,id);
CREATE INDEX classified_messages_spam ON public.classified_messages(sender_id,created_at DESC);

CREATE TABLE public.classified_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.classifieds(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, reporter_id)
);
CREATE INDEX classified_reports_listing ON public.classified_reports(listing_id);

ALTER TABLE public.classifieds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classifieds FORCE ROW LEVEL SECURITY;
ALTER TABLE public.classified_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classified_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.classified_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classified_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.classified_user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classified_user_blocks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.classified_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classified_reports FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.classifieds, public.classified_conversations, public.classified_messages,
  public.classified_user_blocks, public.classified_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,city,author_id,deal_type,category,title,description,district,price_rub,status,created_at,updated_at)
  ON public.classifieds TO anon, authenticated;
GRANT INSERT (city,deal_type,category,title,description,district,price_rub) ON public.classifieds TO authenticated;
GRANT UPDATE (deal_type,category,title,description,district,price_rub,status) ON public.classifieds TO authenticated;
GRANT SELECT (id,listing_id,buyer_id,seller_id,created_at) ON public.classified_conversations TO authenticated;
GRANT SELECT (id,conversation_id,sender_id,body,created_at) ON public.classified_messages TO authenticated;
GRANT SELECT (blocker_id,blocked_id,created_at) ON public.classified_user_blocks TO authenticated;
GRANT INSERT (blocker_id,blocked_id) ON public.classified_user_blocks TO authenticated;
GRANT DELETE ON public.classified_user_blocks TO authenticated;
GRANT INSERT (listing_id,reason) ON public.classified_reports TO authenticated;
GRANT SELECT (id,listing_id,reporter_id,reason,created_at) ON public.classified_reports TO authenticated;

CREATE POLICY classifieds_public ON public.classifieds FOR SELECT TO anon, authenticated
USING(status IN ('published','completed'));
CREATE POLICY classifieds_author_read ON public.classifieds FOR SELECT TO authenticated
USING(author_id=(SELECT auth.uid()));
CREATE POLICY classifieds_editor_read ON public.classifieds FOR SELECT TO authenticated
USING(EXISTS (
  SELECT 1 FROM public.city_admin_access a
  WHERE a.user_id=(SELECT auth.uid()) AND a.active
  AND (a.city=classifieds.city OR (a.city='*' AND a.role='owner'))
));
CREATE POLICY classifieds_author_create ON public.classifieds FOR INSERT TO authenticated
WITH CHECK(author_id=(SELECT auth.uid()) AND status='draft'
  AND EXISTS(SELECT 1 FROM public.city_directory cd WHERE cd.name=city AND cd.active));
CREATE POLICY classifieds_author_edit_unpublished ON public.classifieds FOR UPDATE TO authenticated
USING(author_id=(SELECT auth.uid()) AND status IN ('draft','rejected'))
WITH CHECK(author_id=(SELECT auth.uid()) AND status IN ('draft','pending'));

CREATE POLICY classified_blocks_read_self ON public.classified_user_blocks FOR SELECT TO authenticated
USING(blocker_id=(SELECT auth.uid()));
CREATE POLICY classified_blocks_insert_self ON public.classified_user_blocks FOR INSERT TO authenticated
WITH CHECK(blocker_id=(SELECT auth.uid()));
CREATE POLICY classified_blocks_delete_self ON public.classified_user_blocks FOR DELETE TO authenticated
USING(blocker_id=(SELECT auth.uid()));

CREATE POLICY classified_conversations_participants ON public.classified_conversations FOR SELECT TO authenticated
USING(buyer_id=(SELECT auth.uid()) OR seller_id=(SELECT auth.uid()));

CREATE POLICY classified_messages_participants ON public.classified_messages FOR SELECT TO authenticated
USING(EXISTS (
  SELECT 1 FROM public.classified_conversations c WHERE c.id=conversation_id
  AND (c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid()))
));

CREATE POLICY classified_reports_read_self ON public.classified_reports FOR SELECT TO authenticated
USING(reporter_id=(SELECT auth.uid()));
CREATE POLICY classified_reports_insert_own ON public.classified_reports FOR INSERT TO authenticated
WITH CHECK(reporter_id=(SELECT auth.uid()) AND EXISTS(
 SELECT 1 FROM public.classifieds l WHERE l.id=listing_id AND l.status='published'
 AND l.author_id <> (SELECT auth.uid())
));

-- A resident cannot mark their own listing as published; only active city staff
-- can review. No generic UPDATE permission for moderators is exposed to browser.
CREATE FUNCTION public.review_classified(p_listing_id uuid,p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_city text; v_author uuid; v_status text; v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  SELECT city,author_id,status INTO v_city,v_author,v_status FROM public.classifieds
    WHERE id=p_listing_id FOR UPDATE;
  IF v_city IS NULL OR v_status <> 'pending' THEN
    RAISE EXCEPTION 'Listing is not pending review' USING ERRCODE='42501';
  END IF;
  IF v_author=v_user OR NOT EXISTS (
    SELECT 1 FROM public.city_admin_access a WHERE a.user_id=v_user AND a.active
    AND (a.city=v_city OR (a.city='*' AND a.role='owner'))
  ) THEN RAISE EXCEPTION 'Not authorized to review this listing' USING ERRCODE='42501'; END IF;
  UPDATE public.classifieds SET status=CASE WHEN p_approve THEN 'published' ELSE 'rejected' END WHERE id=p_listing_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_classified(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_classified(uuid,boolean) TO authenticated;

-- Owner of a listing may mark it sold/rented, without editing a published body.
CREATE FUNCTION public.complete_classified(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.classifieds SET status='completed'
    WHERE id=p_listing_id AND author_id=auth.uid() AND status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not available' USING ERRCODE='42501'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_classified(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_classified(uuid) TO authenticated;

-- The caller never controls seller_id, buyer_id or message.sender_id.
-- Advisory transaction lock prevents concurrent requests bypassing daily quota.
CREATE FUNCTION public.open_classified_conversation(p_listing_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid := auth.uid(); v_seller uuid; v_status text; v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 41));
  SELECT author_id,status INTO v_seller,v_status FROM public.classifieds WHERE id=p_listing_id;
  IF v_status IS DISTINCT FROM 'published' OR v_seller=v_user THEN
    RAISE EXCEPTION 'Listing unavailable for conversation' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.classified_user_blocks b
    WHERE (b.blocker_id=v_user AND b.blocked_id=v_seller)
       OR (b.blocker_id=v_seller AND b.blocked_id=v_user)) THEN
    RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501';
  END IF;
  SELECT id INTO v_id FROM public.classified_conversations
    WHERE listing_id=p_listing_id AND buyer_id=v_user;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF (SELECT count(*) FROM public.classified_conversations
    WHERE buyer_id=v_user AND created_at>now()-interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'Daily conversation limit reached' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.classified_conversations(listing_id,buyer_id,seller_id)
    VALUES(p_listing_id,v_user,v_seller) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.open_classified_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_classified_conversation(uuid) TO authenticated;

CREATE FUNCTION public.send_classified_message(p_conversation_id uuid,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid := auth.uid(); v_buyer uuid; v_seller uuid; v_status text; v_id uuid;
BEGIN
  IF v_user IS NULL OR p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Invalid message' USING ERRCODE='42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 42));
  SELECT c.buyer_id,c.seller_id,l.status INTO v_buyer,v_seller,v_status
    FROM public.classified_conversations c JOIN public.classifieds l ON l.id=c.listing_id
    WHERE c.id=p_conversation_id;
  IF v_user NOT IN (v_buyer,v_seller) OR v_status NOT IN ('published','completed') THEN
    RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.classified_user_blocks b
     WHERE (b.blocker_id=v_buyer AND b.blocked_id=v_seller)
        OR (b.blocker_id=v_seller AND b.blocked_id=v_buyer)) THEN
    RAISE EXCEPTION 'Conversation blocked' USING ERRCODE='42501';
  END IF;
  IF (SELECT count(*) FROM public.classified_messages
      WHERE sender_id=v_user AND created_at>now()-interval '5 minutes') >= 25 THEN
    RAISE EXCEPTION 'Too many messages' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.classified_messages(conversation_id,sender_id,body)
     VALUES(p_conversation_id,v_user,btrim(p_body)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_classified_message(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_classified_message(uuid,text) TO authenticated;
