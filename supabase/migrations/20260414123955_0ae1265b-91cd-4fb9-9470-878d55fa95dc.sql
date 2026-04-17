
-- BO Agent Mappings audit/tracking table
CREATE TABLE public.bo_agent_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  agent_name text NOT NULL,
  bo_user_id text NOT NULL,
  sync_status text NOT NULL DEFAULT 'pending',
  synced_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  last_error text,
  bo_response jsonb,
  previous_agent_id uuid REFERENCES public.agents(id),
  previous_agent_name text,
  mapping_reason text NOT NULL DEFAULT 'call_completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bo_agent_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all BO mappings"
  ON public.bo_agent_mappings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents can view own BO mappings"
  ON public.bo_agent_mappings FOR SELECT TO authenticated
  USING (agent_id = get_agent_id_for_user(auth.uid()));

CREATE INDEX idx_bo_mappings_lead ON public.bo_agent_mappings(lead_id);
CREATE INDEX idx_bo_mappings_agent ON public.bo_agent_mappings(agent_id);
CREATE INDEX idx_bo_mappings_status ON public.bo_agent_mappings(sync_status);

-- Add BO sync tracking columns to leads
ALTER TABLE public.leads
  ADD COLUMN bo_user_id text,
  ADD COLUMN bo_sync_status text DEFAULT 'pending',
  ADD COLUMN bo_synced_at timestamptz,
  ADD COLUMN bo_sync_error text;
