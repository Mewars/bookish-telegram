-- «РЯДОМ» / Ryadom-Test ONLY: private unread message state.
-- Apply after classifieds-private-messaging-v1.sql. Never run in production
-- before the approved Russian-data migration and end-to-end acceptance.
--
-- The server records the last *actually selected* message, not an arbitrary
-- client timestamp. Receipts are private to their reader and monotonic.

CREATE TABLE public.classified_conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.classified_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL,
  last_read_id uuid NOT NULL REFERENCES public.classified_messages(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id,user_id)
);
CREATE INDEX classified_conversation_reads_user
  ON public.classified_conversation_reads(user_id,conversation_id);

ALTER TABLE public.classified_conversation_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classified_conversation_reads FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.classified_conversation_reads FROM PUBLIC,anon,authenticated;
GRANT SELECT (conversation_id,user_id,last_read_at,last_read_id)
  ON public.classified_conversation_reads TO authenticated;

CREATE POLICY classified_reads_private_to_reader
  ON public.classified_conversation_reads FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));

-- This function can only update the caller's receipt for a conversation
-- of which they are a buyer or seller. The cursor must be a real message
-- belonging to the same conversation; it can never be forged in the future.
CREATE FUNCTION public.mark_classified_messages_read(
  p_conversation_id uuid,p_message_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_message_at timestamptz;
BEGIN
  IF v_user IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.classified_conversations c
    WHERE c.id=p_conversation_id AND v_user IN (c.buyer_id,c.seller_id)
  ) THEN
    RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501';
  END IF;
  SELECT m.created_at INTO v_message_at
    FROM public.classified_messages m
    WHERE m.id=p_message_id AND m.conversation_id=p_conversation_id;
  IF v_message_at IS NULL THEN
    RAISE EXCEPTION 'Message unavailable in this conversation' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.classified_conversation_reads(
    conversation_id,user_id,last_read_at,last_read_id
  ) VALUES (p_conversation_id,v_user,v_message_at,p_message_id)
  ON CONFLICT(conversation_id,user_id) DO UPDATE
    SET last_read_at=EXCLUDED.last_read_at,last_read_id=EXCLUDED.last_read_id
    WHERE (EXCLUDED.last_read_at,EXCLUDED.last_read_id)>
          (classified_conversation_reads.last_read_at,classified_conversation_reads.last_read_id);
END;
$$;
REVOKE ALL ON FUNCTION public.mark_classified_messages_read(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_classified_messages_read(uuid,uuid)
  TO authenticated;

-- SECURITY INVOKER: existing RLS on conversations and messages still
-- governs the query. Only the authenticated participant's counts are returned.
CREATE FUNCTION public.get_classified_unread_counts()
RETURNS TABLE(conversation_id uuid,unread_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT c.id AS conversation_id,count(m.id)::bigint AS unread_count
  FROM public.classified_conversations c
  JOIN public.classified_messages m
    ON m.conversation_id=c.id AND m.sender_id<>auth.uid()
  LEFT JOIN public.classified_conversation_reads r
    ON r.conversation_id=c.id AND r.user_id=auth.uid()
  WHERE auth.uid() IN (c.buyer_id,c.seller_id)
    AND (r.last_read_at IS NULL OR
         (m.created_at,m.id)>(r.last_read_at,r.last_read_id))
  GROUP BY c.id;
$$;
REVOKE ALL ON FUNCTION public.get_classified_unread_counts()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_classified_unread_counts()
  TO authenticated;
