
-- Function to redistribute ALL leads equally across all active agents
CREATE OR REPLACE FUNCTION public.redistribute_all_leads_equally(
  p_trigger_reason text DEFAULT 'manual',
  p_triggered_by uuid DEFAULT NULL
)
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
  batch_id uuid := gen_random_uuid();
  lock_acquired boolean;
BEGIN
  -- Acquire advisory lock to prevent concurrent redistribution
  lock_acquired := pg_try_advisory_xact_lock(hashtext('redistribute_all_leads'));
  IF NOT lock_acquired THEN
    RETURN jsonb_build_object(
      'redistributed', 0,
      'agents', 0,
      'error', 'Another redistribution is already in progress',
      'batch_id', batch_id::text
    );
  END IF;

  -- Get all active agents
  SELECT array_agg(id ORDER BY created_at, id) INTO agent_ids
  FROM public.agents
  WHERE status = 'active';

  agent_count := coalesce(array_length(agent_ids, 1), 0);

  IF agent_count = 0 THEN
    -- Log the failed attempt
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

    RETURN jsonb_build_object(
      'redistributed', 0,
      'agents', 0,
      'error', 'No active agents found',
      'batch_id', batch_id::text
    );
  END IF;

  -- Get all redistributable leads
  SELECT array_agg(id ORDER BY created_at, id) INTO lead_ids
  FROM public.leads
  WHERE status IN ('new', 'assigned', 'callback')
    AND suppressed = false;

  lead_count := coalesce(array_length(lead_ids, 1), 0);

  IF lead_count = 0 THEN
    RETURN jsonb_build_object(
      'redistributed', 0,
      'agents', agent_count,
      'error', 'No leads to redistribute',
      'batch_id', batch_id::text
    );
  END IF;

  -- Round-robin assign all leads
  FOR i IN 1..lead_count LOOP
    UPDATE public.leads
    SET assigned_agent_id = agent_ids[((i - 1) % agent_count) + 1],
        status = 'assigned',
        updated_at = now()
    WHERE id = lead_ids[i];
  END LOOP;

  -- Log the redistribution event
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
    jsonb_build_object(
      'redistributed', lead_count,
      'agents', agent_count,
      'trigger_reason', p_trigger_reason,
      'batch_id', batch_id::text
    )::text
  );

  RETURN jsonb_build_object(
    'redistributed', lead_count,
    'agents', agent_count,
    'batch_id', batch_id::text,
    'trigger_reason', p_trigger_reason
  );
END;
$$;

-- Trigger function that fires when an agent becomes active
CREATE OR REPLACE FUNCTION public.on_agent_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only fire when status changes TO 'active' (not on other updates)
  IF (TG_OP = 'UPDATE'
      AND OLD.status IS DISTINCT FROM 'active'
      AND NEW.status = 'active')
  THEN
    result := public.redistribute_all_leads_equally(
      'new_agent_activated',
      COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );
    RAISE LOG 'Auto-redistribution triggered for agent %: %', NEW.id, result;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on the agents table
CREATE TRIGGER trg_agent_activated_redistribute
  AFTER UPDATE OF status ON public.agents
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active')
  EXECUTE FUNCTION public.on_agent_activated();
