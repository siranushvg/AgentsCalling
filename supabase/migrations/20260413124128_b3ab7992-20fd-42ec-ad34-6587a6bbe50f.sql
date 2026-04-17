
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_dials', (SELECT count(*) FROM calls WHERE started_at >= p_from AND started_at < p_to),
    'total_ftds', (SELECT count(*) FROM ftd_events WHERE created_at >= p_from AND created_at < p_to AND verified = true),
    'total_ftd_amount', (SELECT coalesce(sum(deposit_amount), 0) FROM ftd_events WHERE created_at >= p_from AND created_at < p_to AND verified = true),
    'total_manual_ftds', (SELECT count(*) FROM calls WHERE started_at >= p_from AND started_at < p_to AND disposition = 'converted'),
    'total_manual_ftd_amount', (
      SELECT coalesce(sum(l.potential_commission), 0)
      FROM calls c
      JOIN leads l ON l.id = c.lead_id
      WHERE c.started_at >= p_from AND c.started_at < p_to AND c.disposition = 'converted'
    ),
    'agent_stats', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          a.id as agent_id,
          a.full_name as agent_name,
          (SELECT count(*) FROM calls c2 WHERE c2.agent_id = a.id AND c2.started_at >= p_from AND c2.started_at < p_to) as dials,
          (SELECT count(*) FROM ftd_events fe WHERE fe.agent_id = a.id AND fe.created_at >= p_from AND fe.created_at < p_to AND fe.verified = true) as ftds,
          (SELECT coalesce(sum(fe2.deposit_amount), 0) FROM ftd_events fe2 WHERE fe2.agent_id = a.id AND fe2.created_at >= p_from AND fe2.created_at < p_to AND fe2.verified = true) as ftd_amount,
          (SELECT count(*) FROM calls c3 WHERE c3.agent_id = a.id AND c3.started_at >= p_from AND c3.started_at < p_to AND c3.disposition = 'converted') as manual_ftds,
          (SELECT coalesce(sum(l.potential_commission), 0) FROM calls c4 JOIN leads l ON l.id = c4.lead_id WHERE c4.agent_id = a.id AND c4.started_at >= p_from AND c4.started_at < p_to AND c4.disposition = 'converted') as manual_ftd_amount
        FROM agents a
        WHERE EXISTS (
          SELECT 1 FROM calls c WHERE c.agent_id = a.id AND c.started_at >= p_from AND c.started_at < p_to
        )
        OR EXISTS (
          SELECT 1 FROM ftd_events fe WHERE fe.agent_id = a.id AND fe.created_at >= p_from AND fe.created_at < p_to
        )
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
          count(*) filter (where c.ftd_verified = true) as ftds
        FROM calls c
        WHERE c.started_at >= p_from AND c.started_at < p_to
        GROUP BY 1, 2
        ORDER BY 2, 1
      ) t
    )
  ) INTO result;

  RETURN coalesce(result, json_build_object('total_dials', 0, 'total_ftds', 0, 'total_ftd_amount', 0, 'total_manual_ftds', 0, 'total_manual_ftd_amount', 0, 'agent_stats', '[]'::json, 'hourly_stats', '[]'::json));
END;
$function$;
