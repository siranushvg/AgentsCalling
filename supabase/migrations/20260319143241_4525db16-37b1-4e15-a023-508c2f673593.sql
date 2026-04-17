
-- Fix overly permissive INSERT policies
DROP POLICY "Authenticated users can create conversations" ON public.internal_conversations;
DROP POLICY "Authenticated users can add participants" ON public.internal_conversation_participants;

-- Only agents and admins can create conversations
CREATE POLICY "Agents and admins can create conversations"
ON public.internal_conversations FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Only conversation creators or admins can add participants
CREATE POLICY "Conversation members can add participants"
ON public.internal_conversation_participants FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  (conversation_id IN (SELECT conversation_id FROM public.internal_conversation_participants WHERE user_id = auth.uid()))
  OR user_id = auth.uid()
);
