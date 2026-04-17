
-- Internal messaging conversations
CREATE TABLE public.internal_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  category TEXT NOT NULL DEFAULT 'general',
  is_important BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Conversation participants
CREATE TABLE public.internal_conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Internal messages
CREATE TABLE public.internal_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.internal_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- RLS: conversations - users can see conversations they participate in
CREATE POLICY "Users can view own conversations"
ON public.internal_conversations FOR SELECT TO authenticated
USING (
  id IN (SELECT conversation_id FROM public.internal_conversation_participants WHERE user_id = auth.uid())
);

-- Admins can see all conversations
CREATE POLICY "Admins can manage all conversations"
ON public.internal_conversations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can create conversations
CREATE POLICY "Authenticated users can create conversations"
ON public.internal_conversations FOR INSERT TO authenticated
WITH CHECK (true);

-- Users can update conversations they participate in
CREATE POLICY "Users can update own conversations"
ON public.internal_conversations FOR UPDATE TO authenticated
USING (
  id IN (SELECT conversation_id FROM public.internal_conversation_participants WHERE user_id = auth.uid())
);

-- Participants: users can see participants of their conversations
CREATE POLICY "Users can view conversation participants"
ON public.internal_conversation_participants FOR SELECT TO authenticated
USING (
  conversation_id IN (SELECT conversation_id FROM public.internal_conversation_participants AS icp WHERE icp.user_id = auth.uid())
);

-- Admins can manage all participants
CREATE POLICY "Admins can manage all participants"
ON public.internal_conversation_participants FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can add participants
CREATE POLICY "Authenticated users can add participants"
ON public.internal_conversation_participants FOR INSERT TO authenticated
WITH CHECK (true);

-- Messages: users can see messages in their conversations
CREATE POLICY "Users can view messages in own conversations"
ON public.internal_messages FOR SELECT TO authenticated
USING (
  conversation_id IN (SELECT conversation_id FROM public.internal_conversation_participants WHERE user_id = auth.uid())
);

-- Admins can manage all messages
CREATE POLICY "Admins can manage all messages"
ON public.internal_messages FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can send messages to conversations they participate in
CREATE POLICY "Users can send messages to own conversations"
ON public.internal_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  conversation_id IN (SELECT conversation_id FROM public.internal_conversation_participants WHERE user_id = auth.uid())
);

-- Users can update their own messages (for read_at)
CREATE POLICY "Users can update messages in own conversations"
ON public.internal_messages FOR UPDATE TO authenticated
USING (
  conversation_id IN (SELECT conversation_id FROM public.internal_conversation_participants WHERE user_id = auth.uid())
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;

-- Updated_at trigger for conversations
CREATE TRIGGER update_internal_conversations_updated_at
  BEFORE UPDATE ON public.internal_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
