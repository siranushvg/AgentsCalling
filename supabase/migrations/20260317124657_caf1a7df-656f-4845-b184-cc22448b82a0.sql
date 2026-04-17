
-- Function to auto-expire leads older than 48 hours that are unconverted
CREATE OR REPLACE FUNCTION public.expire_stale_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.leads
  SET status = 'expired', updated_at = now()
  WHERE status NOT IN ('converted', 'expired', 'not_interested')
    AND signup_at < now() - interval '48 hours';
END;
$$;

-- Function to auto-flag low activity agents
-- Flags: <5 call attempts in 2-hour block, contact rate <20% for 3 days, <20 hours mid-week
CREATE OR REPLACE FUNCTION public.check_low_activity(p_agent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  call_count integer;
  active_hrs numeric;
BEGIN
  -- Check calls in last 2 hours
  SELECT COUNT(*) INTO call_count
  FROM public.calls
  WHERE agent_id = p_agent_id
    AND started_at > now() - interval '2 hours';

  IF call_count < 5 THEN
    INSERT INTO public.low_activity_flags (agent_id, flag_type, severity, details)
    VALUES (p_agent_id, 'Low call attempts', 'medium', 
      'Fewer than 5 call attempts in last 2-hour block (' || call_count || ' attempts)');
  END IF;

  -- Check mid-week hours (below 20)
  SELECT COALESCE(SUM(active_minutes) / 60.0, 0) INTO active_hrs
  FROM public.agent_sessions
  WHERE agent_id = p_agent_id
    AND shift_date >= date_trunc('week', CURRENT_DATE)::date;

  IF active_hrs < 20 AND EXTRACT(DOW FROM CURRENT_DATE) >= 3 THEN
    INSERT INTO public.low_activity_flags (agent_id, flag_type, severity, details)
    VALUES (p_agent_id, 'Mid-week low hours', 'high',
      'Only ' || round(active_hrs, 1) || ' active hours mid-week (threshold: 20)');
  END IF;
END;
$$;
