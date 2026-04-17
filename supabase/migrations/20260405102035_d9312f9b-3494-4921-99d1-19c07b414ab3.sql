
CREATE OR REPLACE FUNCTION public.redistribute_all_leads_equally()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agents uuid[];
  v_agent_count int;
  v_lead record;
  v_idx int := 0;
  v_total int := 0;
BEGIN
  -- Get active agent IDs
  SELECT array_agg(id ORDER BY full_name) INTO v_agents
  FROM agents WHERE status = 'active';
  
  v_agent_count := array_length(v_agents, 1);
  
  -- Round-robin assign all queue leads
  FOR v_lead IN 
    SELECT id FROM leads 
    WHERE status IN ('new', 'assigned', 'callback')
    ORDER BY signup_at DESC
  LOOP
    UPDATE leads 
    SET assigned_agent_id = v_agents[(v_idx % v_agent_count) + 1],
        updated_at = now()
    WHERE id = v_lead.id;
    v_idx := v_idx + 1;
  END LOOP;
  
  v_total := v_idx;
  
  RETURN json_build_object('total_redistributed', v_total, 'agent_count', v_agent_count);
END;
$$;

-- Execute it immediately
SELECT public.redistribute_all_leads_equally();

-- Drop it after use
DROP FUNCTION public.redistribute_all_leads_equally();
