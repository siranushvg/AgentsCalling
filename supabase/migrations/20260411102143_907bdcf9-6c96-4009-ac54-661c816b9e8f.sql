
DROP FUNCTION IF EXISTS public.redistribute_all_leads_equally(text, uuid);

CREATE FUNCTION public.redistribute_all_leads_equally(
  p_trigger_reason text DEFAULT NULL,
  p_triggered_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent_ids uuid[];
  agent_count int;
  lead_ids uuid[];
  lead_count int;
  i int;
  batch_id uuid := gen_random_uuid();
  lock_acquired boolean;
BEGIN
  lock_acquired := pg_try_advisory_xact_lock(hashtext('redistribute_all_leads'));
  IF NOT lock_acquired THEN
    RETURN json_build_object(
      'redistributed', 0,
      'agents', 0,
      'error', 'Another redistribution is already in progress',
      'batch_id', batch_id::text
    );
  END IF;

  SELECT array_agg(id ORDER BY created_at, id) INTO agent_ids
  FROM public.agents
  WHERE status = 'active';

  agent_count := coalesce(array_length(agent_ids, 1), 0);

  IF agent_count = 0 THEN
    IF p_triggered_by IS NOT NULL THEN
      INSERT INTO public.activity_log (actor_id, actor_role, action, target_type, target_id, details)
      VALUES (
        p_triggered_by,
        COALESCE((SELECT role FROM public.user_roles WHERE user_id = p_triggered_by LIMIT 1), 'agent'),
        'auto_redistribute_failed',
        'system',
        batch_id::text,
        'No active agents found. Trigger: ' || p_trigger_reason
      );
    END IF;

    RETURN json_build_object(
      'redistributed', 0,
      'agents', 0,
      'error', 'No active agents found',
      'batch_id', batch_id::text
    );
  END IF;

  -- Get redistributable leads, EXCLUDING leads with pending scheduled callbacks (priority queue)
  SELECT array_agg(id ORDER BY created_at, id) INTO lead_ids
  FROM public.leads
  WHERE status IN ('new', 'assigned', 'callback')
    AND suppressed = false
    AND id NOT IN (
      SELECT lead_id FROM public.scheduled_callbacks
      WHERE status = 'pending'
    );

  lead_count := coalesce(array_length(lead_ids, 1), 0);

  IF lead_count = 0 THEN
    RETURN json_build_object(
      'redistributed', 0,
      'agents', agent_count,
      'error', 'No leads to redistribute',
      'batch_id', batch_id::text
    );
  END IF;

  FOR i IN 1..lead_count LOOP
    UPDATE public.leads
    SET assigned_agent_id = agent_ids[((i - 1) % agent_count) + 1],
        status = 'assigned',
        updated_at = now()
    WHERE id = lead_ids[i];
  END LOOP;

  INSERT INTO public.activity_log (
    actor_id, actor_role, action, target_type, target_id, details
  )
  VALUES (
    COALESCE(p_triggered_by, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(
      (SELECT role FROM public.user_roles WHERE user_id = p_triggered_by LIMIT 1),
      'admin'
    ),
    'auto_leads_redistributed',
    'system',
    batch_id::text,
    json_build_object(
      'redistributed', lead_count,
      'agents', agent_count,
      'trigger_reason', p_trigger_reason,
      'batch_id', batch_id::text
    )::text
  );

  RETURN json_build_object(
    'redistributed', lead_count,
    'agents', agent_count,
    'batch_id', batch_id::text,
    'trigger_reason', p_trigger_reason
  );
END;
$$;
