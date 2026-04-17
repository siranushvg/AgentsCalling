-- Merge duplicate whatsapp_conversations that represent the same phone number
-- Strategy: for each set of duplicates, keep the one with the most messages (or most recent activity),
-- move all messages to it, then delete the empty duplicate

DO $$
DECLARE
  norm text;
  primary_id uuid;
  dup_id uuid;
  dup_ids uuid[];
  moved_count int;
  total_merged int := 0;
BEGIN
  -- Find all normalized phones with duplicates
  FOR norm IN
    SELECT RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) AS n
    FROM whatsapp_conversations
    GROUP BY n
    HAVING count(*) > 1
  LOOP
    -- Pick the primary: the one with most messages, tie-break by most recent last_message_at
    SELECT wc.id INTO primary_id
    FROM whatsapp_conversations wc
    LEFT JOIN LATERAL (
      SELECT count(*) AS cnt FROM whatsapp_messages wm WHERE wm.conversation_id = wc.id
    ) mc ON true
    WHERE RIGHT(regexp_replace(wc.phone_number, '[^0-9]', '', 'g'), 10) = norm
    ORDER BY mc.cnt DESC, wc.last_message_at DESC NULLS LAST
    LIMIT 1;

    -- Get all duplicate IDs (excluding primary)
    SELECT array_agg(wc.id) INTO dup_ids
    FROM whatsapp_conversations wc
    WHERE RIGHT(regexp_replace(wc.phone_number, '[^0-9]', '', 'g'), 10) = norm
      AND wc.id != primary_id;

    IF dup_ids IS NOT NULL AND array_length(dup_ids, 1) > 0 THEN
      -- Move messages from duplicates to primary
      UPDATE whatsapp_messages
      SET conversation_id = primary_id
      WHERE conversation_id = ANY(dup_ids);

      GET DIAGNOSTICS moved_count = ROW_COUNT;

      -- Copy lead_id from duplicate if primary doesn't have one
      UPDATE whatsapp_conversations p
      SET lead_id = (
        SELECT d.lead_id FROM whatsapp_conversations d
        WHERE d.id = ANY(dup_ids) AND d.lead_id IS NOT NULL
        LIMIT 1
      )
      WHERE p.id = primary_id AND p.lead_id IS NULL;

      -- Delete duplicates
      DELETE FROM whatsapp_conversations WHERE id = ANY(dup_ids);

      total_merged := total_merged + array_length(dup_ids, 1);
      RAISE LOG 'Merged % duplicates for phone norm % into %, moved % messages',
        array_length(dup_ids, 1), norm, primary_id, moved_count;
    END IF;
  END LOOP;

  RAISE LOG 'Total duplicate conversations merged: %', total_merged;
END;
$$;
