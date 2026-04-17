
-- Salary settings: global thresholds for eligibility
CREATE TABLE public.salary_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_hours_required numeric NOT NULL DEFAULT 160,
  min_calls_required integer NOT NULL DEFAULT 500,
  call_bonus_amount numeric NOT NULL DEFAULT 5000,
  created_by uuid REFERENCES auth.users(id),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary settings" ON public.salary_settings
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view salary settings" ON public.salary_settings
  FOR SELECT TO authenticated USING (true);

-- Salary tiers: 3 tiers by tenure with different base salary amounts
CREATE TABLE public.salary_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_tenure_months integer NOT NULL DEFAULT 0,
  max_tenure_months integer,
  basic_salary numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary tiers" ON public.salary_tiers
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view salary tiers" ON public.salary_tiers
  FOR SELECT TO authenticated USING (true);

-- Seed default tiers
INSERT INTO public.salary_tiers (name, min_tenure_months, max_tenure_months, basic_salary) VALUES
  ('Junior', 0, 3, 15000),
  ('Mid-Level', 3, 6, 20000),
  ('Senior', 6, NULL, 25000);

-- Seed default salary settings
INSERT INTO public.salary_settings (min_hours_required, min_calls_required, call_bonus_amount, effective_from) VALUES
  (160, 500, 5000, '2026-01-01');

-- Monthly salary records per agent (replaces mg_payments concept)
CREATE TABLE public.salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  month text NOT NULL,
  tier_name text NOT NULL,
  basic_salary numeric NOT NULL DEFAULT 0,
  hours_logged numeric NOT NULL DEFAULT 0,
  hours_eligible boolean NOT NULL DEFAULT false,
  calls_made integer NOT NULL DEFAULT 0,
  calls_eligible boolean NOT NULL DEFAULT false,
  call_bonus numeric NOT NULL DEFAULT 0,
  total_salary numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary payments" ON public.salary_payments
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents can view own salary payments" ON public.salary_payments
  FOR SELECT TO public USING (agent_id = get_agent_id_for_user(auth.uid()));
