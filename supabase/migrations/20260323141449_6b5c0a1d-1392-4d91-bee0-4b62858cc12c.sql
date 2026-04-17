
-- Add columns to leads table for calling system
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS call_priority integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS call_lock_agent_id uuid REFERENCES public.agents(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS call_lock_expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_call_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_called_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suppressed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppression_reason text DEFAULT NULL;

-- Add columns to calls table for calling modes
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS call_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS campaign_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS queue_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1;

-- Call Queues table
CREATE TABLE public.call_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'smart_queue',
  status text NOT NULL DEFAULT 'active',
  priority_rules jsonb NOT NULL DEFAULT '{}',
  description text,
  created_by uuid REFERENCES public.agents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.call_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage call_queues" ON public.call_queues FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Agents can view active queues" ON public.call_queues FOR SELECT TO authenticated USING (status = 'active');

-- Call Campaigns table
CREATE TABLE public.call_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  queue_id uuid REFERENCES public.call_queues(id),
  target_segment jsonb NOT NULL DEFAULT '{}',
  max_attempts integer NOT NULL DEFAULT 3,
  retry_intervals jsonb NOT NULL DEFAULT '["30m","2h","24h"]',
  active_hours_start time NOT NULL DEFAULT '10:00',
  active_hours_end time NOT NULL DEFAULT '21:00',
  script_template text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  suppression_rules jsonb NOT NULL DEFAULT '{}',
  distribution_strategy text NOT NULL DEFAULT 'equal_split',
  status text NOT NULL DEFAULT 'draft',
  total_users integer NOT NULL DEFAULT 0,
  assigned_count integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  converted_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.call_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage campaigns" ON public.call_campaigns FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Agents can view active campaigns" ON public.call_campaigns FOR SELECT TO authenticated USING (status = 'active');

-- Call Queue Members
CREATE TABLE public.call_queue_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.call_queues(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.call_campaigns(id) ON DELETE SET NULL,
  priority_score integer NOT NULL DEFAULT 50,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  retry_after timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_outcome text,
  assigned_agent_id uuid REFERENCES public.agents(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.call_queue_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage queue members" ON public.call_queue_members FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Agents can view assigned queue members" ON public.call_queue_members FOR SELECT TO authenticated USING (
  assigned_agent_id = get_agent_id_for_user(auth.uid()) OR assigned_agent_id IS NULL
);
CREATE POLICY "Agents can update assigned queue members" ON public.call_queue_members FOR UPDATE TO authenticated USING (
  assigned_agent_id = get_agent_id_for_user(auth.uid())
);

-- Campaign Agents
CREATE TABLE public.campaign_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.call_campaigns(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  assigned_count integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  converted_count integer NOT NULL DEFAULT 0,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, agent_id)
);
ALTER TABLE public.campaign_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage campaign_agents" ON public.campaign_agents FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Agents can view own campaign assignments" ON public.campaign_agents FOR SELECT TO authenticated USING (
  agent_id = get_agent_id_for_user(auth.uid())
);

-- Add FK from calls to campaigns and queues
ALTER TABLE public.calls
  ADD CONSTRAINT calls_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.call_campaigns(id),
  ADD CONSTRAINT calls_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.call_queues(id);

-- Index for performance
CREATE INDEX idx_leads_call_priority ON public.leads(call_priority DESC) WHERE suppressed = false;
CREATE INDEX idx_leads_call_lock ON public.leads(call_lock_agent_id) WHERE call_lock_agent_id IS NOT NULL;
CREATE INDEX idx_queue_members_status ON public.call_queue_members(queue_id, status, priority_score DESC);
CREATE INDEX idx_campaign_agents_campaign ON public.campaign_agents(campaign_id, agent_id);
