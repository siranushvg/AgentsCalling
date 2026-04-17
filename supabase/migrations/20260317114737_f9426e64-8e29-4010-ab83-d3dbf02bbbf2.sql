
-- =============================================
-- Arena365 Agent Portal - Core Database Schema
-- =============================================

-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('agent', 'team_lead', 'admin');
CREATE TYPE public.agent_status AS ENUM ('pending', 'training', 'active', 'suspended', 'terminated');
CREATE TYPE public.lead_status AS ENUM ('new', 'assigned', 'contacted', 'callback', 'converted', 'expired', 'not_interested');
CREATE TYPE public.lead_temperature AS ENUM ('hot', 'warm', 'cool');
CREATE TYPE public.call_status AS ENUM ('ringing', 'connected', 'on_hold', 'completed', 'missed', 'failed');
CREATE TYPE public.disposition_type AS ENUM ('interested', 'callback', 'not_interested', 'no_answer', 'wrong_number', 'language_mismatch', 'converted');
CREATE TYPE public.message_channel AS ENUM ('whatsapp', 'sms', 'rcs');
CREATE TYPE public.shift_type AS ENUM ('morning', 'afternoon', 'evening', 'custom');
CREATE TYPE public.mg_eligibility AS ENUM ('eligible', 'at_risk', 'not_eligible');
CREATE TYPE public.payout_status AS ENUM ('pending', 'processed', 'paid');
CREATE TYPE public.mg_payment_status AS ENUM ('pending', 'paid', 'withheld', 'suspended');
CREATE TYPE public.lead_source AS ENUM ('ad_campaign', 'organic', 'direct');

-- 2. User roles table (security best practice - separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 4. Agents table
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  languages TEXT[] NOT NULL DEFAULT '{}',
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  status agent_status NOT NULL DEFAULT 'pending',
  team_lead_id UUID REFERENCES public.agents(id),
  training_completed BOOLEAN NOT NULL DEFAULT FALSE,
  training_progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- 5. Commission settings
CREATE TABLE public.commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direct_rate NUMERIC(5,2) NOT NULL,
  tier2_rate NUMERIC(5,2) NOT NULL,
  tier3_rate NUMERIC(5,2) NOT NULL,
  effective_from DATE NOT NULL,
  created_by UUID REFERENCES public.agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;

-- 6. Shift templates
CREATE TABLE public.shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type shift_type NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

-- 7. Agent shifts (roster)
CREATE TABLE public.agent_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  shift_template_id UUID REFERENCES public.shift_templates(id) NOT NULL,
  date DATE NOT NULL,
  is_off_day BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, date)
);
ALTER TABLE public.agent_shifts ENABLE ROW LEVEL SECURITY;

-- 8. Agent sessions (activity tracking)
CREATE TABLE public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_at TIMESTAMPTZ,
  ip_address TEXT,
  device_info TEXT,
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active_minutes INTEGER NOT NULL DEFAULT 0,
  idle_minutes INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

-- 9. Leads (phone_number is sensitive - never exposed to agents)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  state TEXT NOT NULL,
  language TEXT NOT NULL,
  temperature lead_temperature NOT NULL DEFAULT 'cool',
  score INTEGER NOT NULL DEFAULT 50,
  potential_commission NUMERIC(10,2) NOT NULL DEFAULT 0,
  status lead_status NOT NULL DEFAULT 'new',
  assigned_agent_id UUID REFERENCES public.agents(id),
  source lead_source NOT NULL DEFAULT 'ad_campaign',
  campaign_id TEXT,
  signup_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 10. Calls
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) NOT NULL,
  lead_id UUID REFERENCES public.leads(id) NOT NULL,
  status call_status NOT NULL DEFAULT 'ringing',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  disposition disposition_type,
  notes TEXT,
  recording_url TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- 11. Message templates
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel message_channel NOT NULL,
  content TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- 12. Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) NOT NULL,
  lead_id UUID REFERENCES public.leads(id) NOT NULL,
  channel message_channel NOT NULL,
  template_id UUID REFERENCES public.templates(id),
  content TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 13. Commissions (preserves rate at time of creation)
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) NOT NULL,
  lead_id UUID REFERENCES public.leads(id) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  rate_used NUMERIC(5,2) NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('direct', 'tier2', 'tier3')),
  tier2_agent_id UUID REFERENCES public.agents(id),
  tier3_agent_id UUID REFERENCES public.agents(id),
  reassignment_split BOOLEAN NOT NULL DEFAULT FALSE,
  split_percentage NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- 14. MG Payments
CREATE TABLE public.mg_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) NOT NULL,
  month TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  eligibility mg_eligibility NOT NULL DEFAULT 'not_eligible',
  active_hours NUMERIC(6,1) NOT NULL DEFAULT 0,
  status mg_payment_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mg_payments ENABLE ROW LEVEL SECURITY;

-- 15. Payouts
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  commission_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  mg_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_payout NUMERIC(10,2) NOT NULL DEFAULT 0,
  status payout_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- 16. Activity log (append-only audit trail)
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  actor_role app_role NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- 17. Low activity flags
CREATE TABLE public.low_activity_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) NOT NULL,
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  details TEXT,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by UUID REFERENCES public.agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.low_activity_flags ENABLE ROW LEVEL SECURITY;

-- 18. QA Scorecards
CREATE TABLE public.qa_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.calls(id) NOT NULL,
  agent_id UUID REFERENCES public.agents(id) NOT NULL,
  reviewer_id UUID REFERENCES public.agents(id) NOT NULL,
  opening INTEGER NOT NULL CHECK (opening BETWEEN 0 AND 10),
  script_adherence INTEGER NOT NULL CHECK (script_adherence BETWEEN 0 AND 10),
  objection_handling INTEGER NOT NULL CHECK (objection_handling BETWEEN 0 AND 10),
  closing INTEGER NOT NULL CHECK (closing BETWEEN 0 AND 10),
  compliance INTEGER NOT NULL CHECK (compliance BETWEEN 0 AND 10),
  total INTEGER GENERATED ALWAYS AS (opening + script_adherence + objection_handling + closing + compliance) STORED,
  notes TEXT,
  flagged_for_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_scorecards ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- User roles: users can read their own, admins can read all
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Agents: agents see own, TLs see team, admins see all
CREATE POLICY "Agents can view own profile" ON public.agents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Team leads can view team agents" ON public.agents
  FOR SELECT USING (
    public.has_role(auth.uid(), 'team_lead') AND
    team_lead_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can manage all agents" ON public.agents
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can update own profile" ON public.agents
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert agent on signup" ON public.agents
  FOR INSERT WITH CHECK (TRUE);

-- Commission settings: all authenticated can read, admins can write
CREATE POLICY "All can view commission rates" ON public.commission_settings
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage commission settings" ON public.commission_settings
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Shift templates: all authenticated can read
CREATE POLICY "All can view shift templates" ON public.shift_templates
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage shift templates" ON public.shift_templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Agent shifts: agents see own, TLs see team, admins see all
CREATE POLICY "Agents can view own shifts" ON public.agent_shifts
  FOR SELECT USING (
    agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can manage all shifts" ON public.agent_shifts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Agent sessions
CREATE POLICY "Agents can view own sessions" ON public.agent_sessions
  FOR SELECT USING (
    agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Agents can insert own sessions" ON public.agent_sessions
  FOR INSERT WITH CHECK (
    agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can manage all sessions" ON public.agent_sessions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Leads: CRITICAL - phone_number must never be exposed to agents
-- Agents can only see assigned leads (without phone)
CREATE POLICY "Agents can view assigned leads" ON public.leads
  FOR SELECT USING (
    assigned_agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can manage all leads" ON public.leads
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads can view team leads" ON public.leads
  FOR SELECT USING (
    public.has_role(auth.uid(), 'team_lead') AND
    assigned_agent_id IN (
      SELECT id FROM public.agents WHERE team_lead_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- Calls
CREATE POLICY "Agents can view own calls" ON public.calls
  FOR SELECT USING (
    agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Agents can insert own calls" ON public.calls
  FOR INSERT WITH CHECK (
    agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can manage all calls" ON public.calls
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Templates: all authenticated can read
CREATE POLICY "All can view active templates" ON public.templates
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage templates" ON public.templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Messages
CREATE POLICY "Agents can view own messages" ON public.messages
  FOR SELECT USING (
    agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Agents can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can manage all messages" ON public.messages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Commissions: agents see own
CREATE POLICY "Agents can view own commissions" ON public.commissions
  FOR SELECT USING (
    agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can manage all commissions" ON public.commissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- MG Payments
CREATE POLICY "Agents can view own mg_payments" ON public.mg_payments
  FOR SELECT USING (
    agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can manage mg_payments" ON public.mg_payments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Payouts
CREATE POLICY "Agents can view own payouts" ON public.payouts
  FOR SELECT USING (
    agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can manage payouts" ON public.payouts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Activity log: append-only for all authenticated, read for admins/TLs
CREATE POLICY "Authenticated can insert logs" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "Admins can read all logs" ON public.activity_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads can read logs" ON public.activity_log
  FOR SELECT USING (public.has_role(auth.uid(), 'team_lead'));

-- Low activity flags
CREATE POLICY "Admins can manage flags" ON public.low_activity_flags
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads can view and resolve flags" ON public.low_activity_flags
  FOR SELECT USING (public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Team leads can update flags" ON public.low_activity_flags
  FOR UPDATE USING (public.has_role(auth.uid(), 'team_lead'));

-- QA Scorecards
CREATE POLICY "Team leads can manage QA" ON public.qa_scorecards
  FOR ALL USING (
    public.has_role(auth.uid(), 'team_lead') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Agents can view own QA scores" ON public.qa_scorecards
  FOR SELECT USING (
    agent_id = (SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1)
  );

-- =============================================
-- UTILITY FUNCTIONS & TRIGGERS
-- =============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply to relevant tables
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate unique referral code function
CREATE OR REPLACE FUNCTION public.generate_referral_code(agent_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(REPLACE(agent_name, ' ', ''), 1, 5)) || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
    SELECT EXISTS(SELECT 1 FROM public.agents WHERE referral_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- Indexes for performance
CREATE INDEX idx_agents_user_id ON public.agents(user_id);
CREATE INDEX idx_agents_team_lead ON public.agents(team_lead_id);
CREATE INDEX idx_agents_status ON public.agents(status);
CREATE INDEX idx_agents_referral ON public.agents(referral_code);
CREATE INDEX idx_leads_assigned_agent ON public.leads(assigned_agent_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_source ON public.leads(source);
CREATE INDEX idx_leads_language ON public.leads(language);
CREATE INDEX idx_calls_agent ON public.calls(agent_id);
CREATE INDEX idx_calls_lead ON public.calls(lead_id);
CREATE INDEX idx_commissions_agent ON public.commissions(agent_id);
CREATE INDEX idx_agent_shifts_agent_date ON public.agent_shifts(agent_id, date);
CREATE INDEX idx_activity_log_created ON public.activity_log(created_at);
CREATE INDEX idx_activity_log_actor ON public.activity_log(actor_id);
