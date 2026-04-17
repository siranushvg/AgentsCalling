
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_from timestamptz, p_to timestamptz)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_dials', count(*),
    'total_ftds', count(*) filter (where disposition = 'converted'),
    'agent_stats', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          a.id as agent_id,
          a.full_name as agent_name,
          count(*) as dials,
          count(*) filter (where c.disposition = 'converted') as ftds
        FROM calls c
        JOIN agents a ON a.id = c.agent_id
        WHERE c.started_at >= p_from AND c.started_at < p_to
        GROUP BY a.id, a.full_name
        ORDER BY ftds DESC, dials DESC
      ) t
    ),
    'hourly_stats', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          extract(hour from c.started_at AT TIME ZONE 'Asia/Kolkata')::int as hour,
          to_char(c.started_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as day,
          count(*) as dials,
          count(*) filter (where c.disposition = 'converted') as ftds
        FROM calls c
        WHERE c.started_at >= p_from AND c.started_at < p_to
        GROUP BY 1, 2
        ORDER BY 2, 1
      ) t
    )
  ) INTO result
  FROM calls
  WHERE started_at >= p_from AND started_at < p_to;

  RETURN coalesce(result, json_build_object('total_dials', 0, 'total_ftds', 0, 'agent_stats', '[]'::json, 'hourly_stats', '[]'::json));
END;
$$;
