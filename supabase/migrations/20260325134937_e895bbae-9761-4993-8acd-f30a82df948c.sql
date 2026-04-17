
CREATE TABLE public.agent_training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  module_id integer NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  score integer,
  passed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (agent_id, module_id)
);

ALTER TABLE public.agent_training_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own training modules"
  ON public.agent_training_modules FOR SELECT
  USING (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Agents can insert own training modules"
  ON public.agent_training_modules FOR INSERT
  WITH CHECK (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Agents can update own training modules"
  ON public.agent_training_modules FOR UPDATE
  USING (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Admins can manage all training modules"
  ON public.agent_training_modules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
