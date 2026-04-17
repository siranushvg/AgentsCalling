
CREATE TABLE public.attendance_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  date date NOT NULL,
  current_status text NOT NULL,
  requested_status text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own requests"
ON public.attendance_requests FOR SELECT
USING (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Agents can create own requests"
ON public.attendance_requests FOR INSERT
WITH CHECK (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Admins can manage all requests"
ON public.attendance_requests FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_attendance_requests_updated_at
BEFORE UPDATE ON public.attendance_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
