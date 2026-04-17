
CREATE OR REPLACE FUNCTION public.distribute_leads_to_agents(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  agent_ids uuid[];
  agent_count int;
  lead_ids uuid[];
  lead_count int;
  i int;
BEGIN
  -- Get all active agents
  SELECT array_agg(id ORDER BY id) INTO agent_ids
  FROM public.agents
  WHERE status = 'active';

  agent_count := coalesce(array_length(agent_ids, 1), 0);

  IF agent_count = 0 THEN
    RETURN jsonb_build_object('distributed', 0, 'agents', 0, 'error', 'No active agents found');
  END IF;

  -- Get unassigned leads from this batch
  SELECT array_agg(id ORDER BY created_at) INTO lead_ids
  FROM public.leads
  WHERE import_batch_id = p_batch_id
    AND assigned_agent_id IS NULL
    AND status = 'new';

  lead_count := coalesce(array_length(lead_ids, 1), 0);

  IF lead_count = 0 THEN
    RETURN jsonb_build_object('distributed', 0, 'agents', agent_count, 'error', 'No unassigned leads in batch');
  END IF;

  -- Round-robin assign leads to agents
  FOR i IN 1..lead_count LOOP
    UPDATE public.leads
    SET assigned_agent_id = agent_ids[((i - 1) % agent_count) + 1],
        status = 'assigned',
        updated_at = now()
    WHERE id = lead_ids[i];
  END LOOP;

  RETURN jsonb_build_object('distributed', lead_count, 'agents', agent_count);
END;
$$;
