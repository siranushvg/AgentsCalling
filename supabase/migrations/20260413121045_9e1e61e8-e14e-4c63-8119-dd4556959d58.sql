
-- 1. Create ftd_events table for verified FTDs
CREATE TABLE public.ftd_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  call_id uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  phone_number text,
  username text,
  deposit_amount numeric NOT NULL DEFAULT 0,
  external_reference text,
  source text NOT NULL DEFAULT 'webhook',
  verified boolean NOT NULL DEFAULT true,
  matched_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ftd_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all ftd_events"
  ON public.ftd_events FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents can view own ftd_events"
  ON public.ftd_events FOR SELECT
  USING (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Team leads can view team ftd_events"
  ON public.ftd_events FOR SELECT
  USING (
    has_role(auth.uid(), 'team_lead'::app_role)
    AND agent_id IN (
      SELECT id FROM agents WHERE team_lead_id = get_agent_id_for_user(auth.uid())
    )
  );

-- Index for fast lookups
CREATE INDEX idx_ftd_events_lead_id ON public.ftd_events(lead_id);
CREATE INDEX idx_ftd_events_agent_id ON public.ftd_events(agent_id);
CREATE INDEX idx_ftd_events_phone ON public.ftd_events(phone_number);
CREATE INDEX idx_ftd_events_created_at ON public.ftd_events(created_at);

-- 2. Add ftd_verified flag to calls table
ALTER TABLE public.calls ADD COLUMN ftd_verified boolean NOT NULL DEFAULT false;

-- 3. Update get_dashboard_stats to include verified FTDs
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
    'total_manual_ftds', (SELECT count(*) FROM calls WHERE started_at >= p_from AND started_at < p_to AND disposition = 'converted'),
    'agent_stats', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          a.id as agent_id,
          a.full_name as agent_name,
          (SELECT count(*) FROM calls c2 WHERE c2.agent_id = a.id AND c2.started_at >= p_from AND c2.started_at < p_to) as dials,
          (SELECT count(*) FROM ftd_events fe WHERE fe.agent_id = a.id AND fe.created_at >= p_from AND fe.created_at < p_to AND fe.verified = true) as ftds,
          (SELECT count(*) FROM calls c3 WHERE c3.agent_id = a.id AND c3.started_at >= p_from AND c3.started_at < p_to AND c3.disposition = 'converted') as manual_ftds
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

  RETURN coalesce(result, json_build_object('total_dials', 0, 'total_ftds', 0, 'total_manual_ftds', 0, 'agent_stats', '[]'::json, 'hourly_stats', '[]'::json));
END;
$function$;
