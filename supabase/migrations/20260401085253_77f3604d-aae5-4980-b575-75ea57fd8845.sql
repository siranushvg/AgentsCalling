
-- WhatsApp conversations table
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  wa_id text NOT NULL,
  display_name text,
  phone_number text NOT NULL,
  last_message_text text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(phone_number)
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all whatsapp_conversations" ON public.whatsapp_conversations
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can view whatsapp_conversations" ON public.whatsapp_conversations
  FOR SELECT TO authenticated USING (true);

-- WhatsApp messages table
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message_text text,
  template_name text,
  status text NOT NULL DEFAULT 'sent',
  provider text NOT NULL DEFAULT 'wati',
  provider_message_id text,
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all whatsapp_messages" ON public.whatsapp_messages
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can view whatsapp_messages" ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Agents can insert whatsapp_messages" ON public.whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (agent_id = get_agent_id_for_user(auth.uid()));
