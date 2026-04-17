
-- Agent onboarding submissions
CREATE TABLE public.agent_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  fathers_name text NOT NULL DEFAULT '',
  aadhar_number text NOT NULL DEFAULT '',
  bank_account_name text NOT NULL DEFAULT '',
  bank_account_number text NOT NULL DEFAULT '',
  bank_ifsc text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarding_status text NOT NULL DEFAULT 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id)
);

ALTER TABLE public.agent_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own onboarding"
  ON public.agent_onboarding FOR SELECT
  USING (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Agents can insert own onboarding"
  ON public.agent_onboarding FOR INSERT
  WITH CHECK (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Agents can update own onboarding"
  ON public.agent_onboarding FOR UPDATE
  USING (agent_id = get_agent_id_for_user(auth.uid()) AND onboarding_status IN ('draft', 'rejected'));

CREATE POLICY "Admins can manage all onboarding"
  ON public.agent_onboarding FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_agent_onboarding_updated_at
  BEFORE UPDATE ON public.agent_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin-defined custom fields
CREATE TABLE public.onboarding_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name text NOT NULL UNIQUE,
  field_label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  options jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view active custom fields"
  ON public.onboarding_custom_fields FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage custom fields"
  ON public.onboarding_custom_fields FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_onboarding_custom_fields_updated_at
  BEFORE UPDATE ON public.onboarding_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Uploaded documents tracking
CREATE TABLE public.onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own documents"
  ON public.onboarding_documents FOR SELECT
  USING (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Agents can insert own documents"
  ON public.onboarding_documents FOR INSERT
  WITH CHECK (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Agents can delete own documents"
  ON public.onboarding_documents FOR DELETE
  USING (agent_id = get_agent_id_for_user(auth.uid()));

CREATE POLICY "Admins can manage all documents"
  ON public.onboarding_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Storage bucket for onboarding documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('onboarding-documents', 'onboarding-documents', false, 10485760);

-- Storage policies
CREATE POLICY "Agents can upload own onboarding docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'onboarding-documents' AND (storage.foldername(name))[1] = get_agent_id_for_user(auth.uid())::text);

CREATE POLICY "Agents can view own onboarding docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'onboarding-documents' AND (storage.foldername(name))[1] = get_agent_id_for_user(auth.uid())::text);

CREATE POLICY "Agents can delete own onboarding docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'onboarding-documents' AND (storage.foldername(name))[1] = get_agent_id_for_user(auth.uid())::text);

CREATE POLICY "Admins can manage all onboarding docs"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'onboarding-documents' AND has_role(auth.uid(), 'admin'));
