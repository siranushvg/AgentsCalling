
-- Fix infinite recursion: the SELECT policy on internal_conversation_participants
-- references itself causing the loop. Replace with a SECURITY DEFINER function.

CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_conversation_participants
    WHERE user_id = _user_id AND conversation_id = _conversation_id
  )
$$;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Users can view conversation participants" ON internal_conversation_participants;
DROP POLICY IF EXISTS "Conversation members can add participants" ON internal_conversation_participants;

-- Recreate with the function to break recursion
CREATE POLICY "Users can view conversation participants"
  ON internal_conversation_participants FOR SELECT TO authenticated
  USING (is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Conversation members can add participants"
  ON internal_conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_conversation_member(auth.uid(), conversation_id)
    OR user_id = auth.uid()
  );

-- Also fix internal_conversations policies that reference the participants table
DROP POLICY IF EXISTS "Users can view own conversations" ON internal_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON internal_conversations;

CREATE POLICY "Users can view own conversations"
  ON internal_conversations FOR SELECT TO authenticated
  USING (is_conversation_member(auth.uid(), id));

CREATE POLICY "Users can update own conversations"
  ON internal_conversations FOR UPDATE TO authenticated
  USING (is_conversation_member(auth.uid(), id));

-- Fix internal_messages policies too
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON internal_messages;
DROP POLICY IF EXISTS "Users can send messages to own conversations" ON internal_messages;
DROP POLICY IF EXISTS "Users can update messages in own conversations" ON internal_messages;

CREATE POLICY "Users can view messages in own conversations"
  ON internal_messages FOR SELECT TO authenticated
  USING (is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Users can send messages to own conversations"
  ON internal_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Users can update messages in own conversations"
  ON internal_messages FOR UPDATE TO authenticated
  USING (is_conversation_member(auth.uid(), conversation_id));
