
-- Helper function to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.can_view_whatsapp_conversation(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Lead is assigned to the agent
    SELECT 1
    FROM public.whatsapp_conversations wc
    JOIN public.leads l ON l.id = wc.lead_id
    JOIN public.agents a ON a.id = l.assigned_agent_id
    WHERE wc.id = _conversation_id
      AND a.user_id = _user_id
  )
  OR EXISTS (
    -- Agent sent messages in this conversation
    SELECT 1
    FROM public.whatsapp_messages wm
    JOIN public.agents a ON a.id = wm.agent_id
    WHERE wm.conversation_id = _conversation_id
      AND a.user_id = _user_id
  )
  OR EXISTS (
    -- Agent has calls to the lead linked to this conversation
    SELECT 1
    FROM public.whatsapp_conversations wc
    JOIN public.calls c ON c.lead_id = wc.lead_id
    JOIN public.agents a ON a.id = c.agent_id
    WHERE wc.id = _conversation_id
      AND a.user_id = _user_id
  )
$$;

-- Drop the permissive agent SELECT policies
DROP POLICY IF EXISTS "Agents can view whatsapp_conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Agents can view whatsapp_messages" ON public.whatsapp_messages;

-- New scoped policy for conversations
CREATE POLICY "Agents can view own whatsapp_conversations"
ON public.whatsapp_conversations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_view_whatsapp_conversation(auth.uid(), id)
);

-- New scoped policy for messages
CREATE POLICY "Agents can view own whatsapp_messages"
ON public.whatsapp_messages
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_view_whatsapp_conversation(auth.uid(), conversation_id)
);
