
-- Allow conversation participants to see each other's profiles
CREATE POLICY "Conversation participants can view peer profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT p2.user_id
      FROM public.internal_conversation_participants p1
      JOIN public.internal_conversation_participants p2
        ON p1.conversation_id = p2.conversation_id
      WHERE p1.user_id = auth.uid()
    )
  );
