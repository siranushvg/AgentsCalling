
CREATE TABLE public.early_login_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  shift_date date NOT NULL DEFAULT CURRENT_DATE,
  shift_start_time time NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, shift_date)
);

ALTER TABLE public.early_login_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own early login requests"
  ON public.early_login_requests FOR SELECT
  USING (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Agents can insert own early login requests"
  ON public.early_login_requests FOR INSERT
  WITH CHECK (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Admins can manage all early login requests"
  ON public.early_login_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.early_login_requests;
