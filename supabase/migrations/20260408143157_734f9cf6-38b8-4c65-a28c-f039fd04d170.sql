
CREATE TABLE public.sms_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'laaffic',
  provider_message_id text,
  phone_number text NOT NULL,
  content text NOT NULL,
  sender_id text,
  order_id text,
  status text NOT NULL DEFAULT 'pending',
  provider_status_code integer,
  provider_reason text,
  success_count integer DEFAULT 0,
  fail_count integer DEFAULT 0,
  raw_response jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone
);

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- Admins can manage all SMS records
CREATE POLICY "Admins can manage all sms_messages"
  ON public.sms_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Agents can view SMS for their assigned leads
CREATE POLICY "Agents can view own sms_messages"
  ON public.sms_messages FOR SELECT
  USING (agent_id = get_agent_id_for_user(auth.uid()));

-- Agents can insert SMS for their assigned leads
CREATE POLICY "Agents can insert own sms_messages"
  ON public.sms_messages FOR INSERT
  WITH CHECK (agent_id = get_agent_id_for_user(auth.uid()));

-- Team leads can view SMS for their team
CREATE POLICY "Team leads can view sms_messages"
  ON public.sms_messages FOR SELECT
  USING (has_role(auth.uid(), 'team_lead'::app_role));

-- Index for common queries
CREATE INDEX idx_sms_messages_lead_id ON public.sms_messages (lead_id);
CREATE INDEX idx_sms_messages_agent_id ON public.sms_messages (agent_id);
CREATE INDEX idx_sms_messages_created_at ON public.sms_messages (created_at DESC);
