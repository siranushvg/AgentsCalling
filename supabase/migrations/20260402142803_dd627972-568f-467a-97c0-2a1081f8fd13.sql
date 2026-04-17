
CREATE OR REPLACE FUNCTION public.redistribute_agent_leads(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lead_ids uuid[];
  lead_count int;
  online_agent_ids uuid[];
  agent_count int;
  i int;
  batch_id uuid := gen_random_uuid();
  target_agent_id uuid;
BEGIN
  -- 1. Collect all active leads assigned to this agent
  SELECT array_agg(id ORDER BY created_at)
  INTO lead_ids
  FROM public.leads
  WHERE assigned_agent_id = p_agent_id
    AND status IN ('new', 'assigned', 'callback')
    AND suppressed = false;

  lead_count := coalesce(array_length(lead_ids, 1), 0);

  IF lead_count = 0 THEN
    RETURN jsonb_build_object(
      'redistributed', 0,
      'online_agents', 0,
      'unassigned', false,
      'batch_id', batch_id::text
    );
  END IF;

  -- 2. Find online, active agents (excluding the signing-out agent)
  --    "Online" = has a profile with last_activity_at within the last 15 minutes
  --    AND agent status = 'active'
  SELECT array_agg(a.id ORDER BY a.id)
  INTO online_agent_ids
  FROM public.agents a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.id != p_agent_id
    AND a.status = 'active'
    AND p.session_status = 'active'
    AND p.last_activity_at > now() - interval '15 minutes';

  agent_count := coalesce(array_length(online_agent_ids, 1), 0);

  IF agent_count = 0 THEN
    -- No online agents: move leads to unassigned pool
    UPDATE public.leads
    SET assigned_agent_id = NULL,
        status = 'new',
        updated_at = now()
    WHERE id = ANY(lead_ids);

    -- Log the event
    INSERT INTO public.activity_log (actor_id, actor_role, action, target_type, target_id, details)
    VALUES (
      p_agent_id,
      (SELECT role FROM public.user_roles ur JOIN public.agents ag ON ag.user_id = ur.user_id WHERE ag.id = p_agent_id LIMIT 1),
      'leads_unassigned_on_signout',
      'agent',
      p_agent_id::text,
      lead_count || ' leads moved to unassigned pool (no online agents). Batch: ' || batch_id::text
    );

    RETURN jsonb_build_object(
      'redistributed', lead_count,
      'online_agents', 0,
      'unassigned', true,
      'batch_id', batch_id::text
    );
  END IF;

  -- 3. Round-robin redistribute
  FOR i IN 1..lead_count LOOP
    target_agent_id := online_agent_ids[((i - 1) % agent_count) + 1];

    UPDATE public.leads
    SET assigned_agent_id = target_agent_id,
        status = 'assigned',
        updated_at = now()
    WHERE id = lead_ids[i];
  END LOOP;

  -- 4. Log the redistribution event
  INSERT INTO public.activity_log (actor_id, actor_role, action, target_type, target_id, details)
  VALUES (
    p_agent_id,
    (SELECT role FROM public.user_roles ur JOIN public.agents ag ON ag.user_id = ur.user_id WHERE ag.id = p_agent_id LIMIT 1),
    'leads_redistributed_on_signout',
    'agent',
    p_agent_id::text,
    lead_count || ' leads redistributed to ' || agent_count || ' online agents. Batch: ' || batch_id::text
  );

  RETURN jsonb_build_object(
    'redistributed', lead_count,
    'online_agents', agent_count,
    'unassigned', false,
    'batch_id', batch_id::text
  );
END;
$$;
