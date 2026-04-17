
CREATE OR REPLACE FUNCTION public.reap_stale_calls()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stale_ringing_count int;
  stale_active_count int;
BEGIN
  -- Mark calls stuck in 'ringing' for >5 minutes as 'missed'
  WITH updated AS (
    UPDATE public.calls
    SET status = 'missed',
        ended_at = now(),
        duration_seconds = 0
    WHERE status = 'ringing'
      AND started_at < now() - interval '5 minutes'
      AND ended_at IS NULL
    RETURNING id
  )
  SELECT count(*) INTO stale_ringing_count FROM updated;

  -- Mark calls stuck in 'connected'/'on_hold' for >2 hours as 'failed'
  WITH updated AS (
    UPDATE public.calls
    SET status = 'failed',
        ended_at = now(),
        duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::int
    WHERE status IN ('connected', 'on_hold')
      AND started_at < now() - interval '2 hours'
      AND ended_at IS NULL
    RETURNING id
  )
  SELECT count(*) INTO stale_active_count FROM updated;

  IF stale_ringing_count > 0 OR stale_active_count > 0 THEN
    RAISE LOG 'reap_stale_calls: reaped % ringing, % active calls', stale_ringing_count, stale_active_count;
  END IF;

  RETURN jsonb_build_object(
    'reaped_ringing', stale_ringing_count,
    'reaped_active', stale_active_count,
    'run_at', now()
  );
END;
$$;
