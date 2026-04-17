
-- Table to store admin attendance overrides
CREATE TABLE public.attendance_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  original_status TEXT NOT NULL, -- 'present', 'half_day', 'absent'
  override_status TEXT NOT NULL, -- 'present', 'half_day', 'absent', 'weekoff'
  override_reason TEXT,
  overridden_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (agent_id, date)
);

-- Enable RLS
ALTER TABLE public.attendance_overrides ENABLE ROW LEVEL SECURITY;

-- Only admins can manage attendance overrides
CREATE POLICY "Admins can manage attendance overrides"
  ON public.attendance_overrides
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_attendance_overrides_updated_at
  BEFORE UPDATE ON public.attendance_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
