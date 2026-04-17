
CREATE TABLE public.admin_test_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  channel TEXT NOT NULL,
  test_number TEXT NOT NULL,
  message_content TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_status TEXT,
  provider_reason TEXT,
  raw_response JSONB,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_test BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.admin_test_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view test messages"
ON public.admin_test_messages FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert test messages"
ON public.admin_test_messages FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
