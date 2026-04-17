
CREATE TABLE public.scheduled_callbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  lead_name TEXT NOT NULL,
  disposition TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own callbacks"
  ON public.scheduled_callbacks FOR SELECT
  TO authenticated
  USING (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Agents can insert own callbacks"
  ON public.scheduled_callbacks FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Agents can update own callbacks"
  ON public.scheduled_callbacks FOR UPDATE
  TO authenticated
  USING (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Admins can manage all callbacks"
  ON public.scheduled_callbacks FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
