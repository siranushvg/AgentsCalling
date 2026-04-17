import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Notification sound using Web Audio API
function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio not available
  }
}

export interface Conversation {
  id: string;
  category: string;
  is_important: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  participants: { user_id: string; role: string; full_name: string }[];
  last_message?: { content: string; created_at: string; sender_id: string; sender_role: string };
  unread_count: number;
}

export interface InternalMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

const CATEGORIES = ['general', 'shift_issue', 'lead_issue', 'support', 'payment_question', 'performance', 'urgent'] as const;
export type MessageCategory = typeof CATEGORIES[number];
export const MESSAGE_CATEGORIES = CATEGORIES;

export const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  shift_issue: 'Shift Issue',
  lead_issue: 'Lead Issue',
  support: 'Support',
  payment_question: 'Payment',
  performance: 'Performance',
  urgent: 'Urgent',
};

export function useInternalMessaging() {
  const { user, role } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationGroups, setConversationGroups] = useState<Record<string, string[]>>({});

  const buildConversationGroups = useCallback((items: Conversation[]) => {
    if (!user) {
      return { groupedConversations: items, groupedIds: {} as Record<string, string[]> };
    }

    type GroupedConversation = Conversation & { _ids: string[]; _activityTs: number };
    const grouped = new Map<string, GroupedConversation>();
    const preferredOtherRole = role === 'admin' ? 'agent' : role === 'agent' ? 'admin' : undefined;

    for (const convo of items) {
      const otherParticipant = (preferredOtherRole
        ? convo.participants.find((p) => p.role === preferredOtherRole)
        : undefined) ?? convo.participants.find((p) => p.user_id !== user.id);
      const groupKey = otherParticipant?.user_id || convo.id;
      const activityTs = convo.last_message
        ? new Date(convo.last_message.created_at).getTime()
        : new Date(convo.updated_at).getTime();

      const existing = grouped.get(groupKey);

      if (!existing) {
        grouped.set(groupKey, {
          ...convo,
          _ids: [convo.id],
          _activityTs: activityTs,
        });
        continue;
      }

      existing._ids.push(convo.id);
      existing.unread_count += convo.unread_count;
      existing.is_important = existing.is_important || convo.is_important;

      if (activityTs > existing._activityTs) {
        existing.id = convo.id;
        existing.category = convo.category;
        existing.created_at = convo.created_at;
        existing.updated_at = convo.updated_at;
        existing.archived_at = convo.archived_at;
        existing.participants = convo.participants;
        existing.last_message = convo.last_message;
        existing._activityTs = activityTs;
      }
    }

    const groupedValues = Array.from(grouped.values());

    const groupedConversations = groupedValues
      .sort((a, b) => b._activityTs - a._activityTs)
      .map(({ _ids, _activityTs, ...conversation }) => conversation);

    const groupedIds = groupedValues.reduce<Record<string, string[]>>((acc, conversation) => {
      acc[conversation.id] = conversation._ids;
      return acc;
    }, {});

    return { groupedConversations, groupedIds };
  }, [user, role]);

  const getConversationIds = useCallback((conversationId: string) => {
    return conversationGroups[conversationId] ?? [conversationId];
  }, [conversationGroups]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch conversations the user participates in
      const { data: myParticipations, error: partErr } = await supabase
        .from('internal_conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (partErr) {
        console.error('Failed to fetch participations:', partErr);
        setConversations([]);
        setLoading(false);
        return;
      }

      const myConvoIds = (myParticipations || []).map(p => p.conversation_id);
      if (myConvoIds.length === 0) {
        setConversations([]);
        setConversationGroups({});
        setLoading(false);
        return;
      }

      // 2. Fetch those conversations
      const { data: convos, error: convoErr } = await supabase
        .from('internal_conversations')
        .select('*')
        .in('id', myConvoIds)
        .is('archived_at', null)
        .order('updated_at', { ascending: false });

      if (convoErr || !convos) {
        console.error('Failed to fetch conversations:', convoErr);
        setConversations([]);
        setLoading(false);
        return;
      }

      const convoIds = convos.map(c => c.id);

      // 3. Batch fetch all participants for all conversations
      const { data: allParticipants } = await supabase
        .from('internal_conversation_participants')
        .select('conversation_id, user_id, role')
        .in('conversation_id', convoIds);

      // 4. Batch fetch all participant profiles at once
      const allUserIds = [...new Set((allParticipants || []).map(p => p.user_id))];
      const profileMap: Record<string, string> = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', allUserIds);
        (profiles || []).forEach(p => {
          profileMap[p.id] = p.full_name || 'Unknown';
        });
      }

      // 5. Batch fetch last message per conversation
      const { data: allMessages } = await supabase
        .from('internal_messages')
        .select('conversation_id, content, created_at, sender_id, sender_role')
        .in('conversation_id', convoIds)
        .order('created_at', { ascending: false });

      const lastMessageMap: Record<string, { content: string; created_at: string; sender_id: string; sender_role: string }> = {};
      (allMessages || []).forEach(m => {
        if (!lastMessageMap[m.conversation_id]) {
          lastMessageMap[m.conversation_id] = {
            content: m.content,
            created_at: m.created_at,
            sender_id: m.sender_id,
            sender_role: m.sender_role,
          };
        }
      });

      // 6. Batch fetch unread counts
      const { data: unreadMessages } = await supabase
        .from('internal_messages')
        .select('conversation_id')
        .in('conversation_id', convoIds)
        .is('read_at', null)
        .neq('sender_id', user.id);

      const unreadMap: Record<string, number> = {};
      (unreadMessages || []).forEach(m => {
        unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
      });

      // 7. Assemble enriched conversations
      const participantsByConvo: Record<string, { user_id: string; role: string; full_name: string }[]> = {};
      (allParticipants || []).forEach(p => {
        if (!participantsByConvo[p.conversation_id]) participantsByConvo[p.conversation_id] = [];
        participantsByConvo[p.conversation_id].push({
          user_id: p.user_id,
          role: p.role,
          full_name: profileMap[p.user_id] || 'Unknown',
        });
      });

      const enriched: Conversation[] = convos.map(c => ({
        id: c.id,
        category: c.category,
        is_important: c.is_important,
        created_at: c.created_at,
        updated_at: c.updated_at,
        archived_at: c.archived_at,
        participants: participantsByConvo[c.id] || [],
        last_message: lastMessageMap[c.id],
        unread_count: unreadMap[c.id] || 0,
      }));

      const { groupedConversations, groupedIds } = buildConversationGroups(enriched);
      setConversations(groupedConversations);
      setConversationGroups(groupedIds);
    } catch (err) {
      console.error('Internal messaging fetch error:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [user, buildConversationGroups]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Track whether initial load is done to avoid notifications on first render
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!loading && conversations.length >= 0) {
      const t = setTimeout(() => { initialLoadDone.current = true; }, 2000);
      return () => clearTimeout(t);
    }
  }, [loading]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('internal-messages-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_messages' }, (payload) => {
        const newMsg = payload.new as { sender_id?: string; content?: string };
        if (newMsg.sender_id !== user.id && initialLoadDone.current) {
          playNotificationSound();
          const content = newMsg.content ?? '';
          toast.info('New Message', {
            description: content.substring(0, 80) + (content.length > 80 ? '...' : ''),
            duration: 5000,
          });
        }
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  const getMessages = async (conversationId: string): Promise<InternalMessage[]> => {
    const conversationIds = getConversationIds(conversationId);

    const { data, error } = await supabase
      .from('internal_messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch messages:', error);
      toast.error('Failed to load messages');
      return [];
    }

    return (data || []) as InternalMessage[];
  };

  const sendMessage = async (conversationId: string, content: string): Promise<boolean> => {
    if (!user || !role) {
      toast.error('You must be logged in to send messages');
      return false;
    }

    const { error: msgErr } = await supabase.from('internal_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: role,
      content,
    });

    if (msgErr) {
      console.error('Failed to send message:', msgErr);
      toast.error('Failed to send message. Please try again.');
      return false;
    }

    const { error: updateErr } = await supabase
      .from('internal_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (updateErr) {
      console.error('Failed to update conversation timestamp:', updateErr);
    }

    return true;
  };

  const markRead = async (conversationId: string) => {
    if (!user) return;

    const conversationIds = getConversationIds(conversationId);

    const { error } = await supabase
      .from('internal_messages')
      .update({ read_at: new Date().toISOString() })
      .in('conversation_id', conversationIds)
      .is('read_at', null)
      .neq('sender_id', user.id);

    if (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const createConversation = async (recipientId: string, recipientRole: string, category: MessageCategory, firstMessage: string): Promise<string | null> => {
    if (!user || !role) return null;

    try {
      // Check for existing conversation with same participants and category
      let candidateConversationIds: string[] = [];

      if (role === 'admin' && recipientRole === 'agent') {
        const { data: recipientParticipations } = await supabase
          .from('internal_conversation_participants')
          .select('conversation_id')
          .eq('user_id', recipientId);

        const recipientConversationIds = recipientParticipations?.map((p) => p.conversation_id) ?? [];

        if (recipientConversationIds.length > 0) {
          const { data: adminParticipations } = await supabase
            .from('internal_conversation_participants')
            .select('conversation_id')
            .eq('role', 'admin')
            .in('conversation_id', recipientConversationIds);

          candidateConversationIds = adminParticipations?.map((p) => p.conversation_id) ?? [];
        }
      } else if (role === 'agent' && recipientRole === 'admin') {
        const { data: myParticipations } = await supabase
          .from('internal_conversation_participants')
          .select('conversation_id')
          .eq('user_id', user.id);

        const myConversationIds = myParticipations?.map((p) => p.conversation_id) ?? [];

        if (myConversationIds.length > 0) {
          const { data: adminParticipations } = await supabase
            .from('internal_conversation_participants')
            .select('conversation_id')
            .eq('role', 'admin')
            .in('conversation_id', myConversationIds);

          candidateConversationIds = adminParticipations?.map((p) => p.conversation_id) ?? [];
        }
      } else {
        const { data: myParticipations } = await supabase
          .from('internal_conversation_participants')
          .select('conversation_id')
          .eq('user_id', user.id);

        const myConversationIds = myParticipations?.map((p) => p.conversation_id) ?? [];

        if (myConversationIds.length > 0) {
          const { data: recipientParticipations } = await supabase
            .from('internal_conversation_participants')
            .select('conversation_id')
            .eq('user_id', recipientId)
            .in('conversation_id', myConversationIds);

          candidateConversationIds = recipientParticipations?.map((p) => p.conversation_id) ?? [];
        }
      }

      // Find existing matching conversation
      let existingConvoId: string | null = null;

      if (candidateConversationIds.length > 0) {
        const { data: existingConversations } = await supabase
          .from('internal_conversations')
          .select('id')
          .in('id', candidateConversationIds)
          .eq('category', category)
          .is('archived_at', null)
          .order('updated_at', { ascending: false })
          .limit(1);

        existingConvoId = existingConversations?.[0]?.id ?? null;
      }

      if (existingConvoId) {
        // Reuse existing conversation
        const { error: msgErr } = await supabase.from('internal_messages').insert({
          conversation_id: existingConvoId,
          sender_id: user.id,
          sender_role: role,
          content: firstMessage,
        });

        if (msgErr) {
          console.error('Failed to send message to existing conversation:', msgErr);
          toast.error('Failed to send message');
          return null;
        }

        await supabase
          .from('internal_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', existingConvoId);

        await fetchConversations();
        return existingConvoId;
      }

      // Create new conversation
      const { data: convo, error: convoErr } = await supabase
        .from('internal_conversations')
        .insert({ category })
        .select()
        .single();

      if (convoErr || !convo) {
        console.error('Failed to create conversation:', convoErr);
        toast.error('Failed to create conversation');
        return null;
      }

      // Insert self first so RLS recognizes us as a member for the second insert
      const { error: selfErr } = await supabase.from('internal_conversation_participants').insert(
        { conversation_id: convo.id, user_id: user.id, role },
      );
      if (selfErr) {
        console.error('Failed to add self as participant:', selfErr);
        toast.error('Failed to create conversation');
        return null;
      }

      const { error: recipientErr } = await supabase.from('internal_conversation_participants').insert(
        { conversation_id: convo.id, user_id: recipientId, role: recipientRole },
      );
      if (recipientErr) {
        console.error('Failed to add recipient as participant:', recipientErr);
        toast.error('Failed to add recipient to conversation');
        // Continue anyway - conversation exists with at least the sender
      }

      const { error: msgErr } = await supabase.from('internal_messages').insert({
        conversation_id: convo.id,
        sender_id: user.id,
        sender_role: role,
        content: firstMessage,
      });
      if (msgErr) {
        console.error('Failed to send first message:', msgErr);
        toast.error('Failed to send message');
        return null;
      }

      await fetchConversations();
      return convo.id;
    } catch (err) {
      console.error('Create conversation error:', err);
      toast.error('An unexpected error occurred');
      return null;
    }
  };

  const toggleImportant = async (conversationId: string, current: boolean) => {
    const conversationIds = getConversationIds(conversationId);

    const { error } = await supabase
      .from('internal_conversations')
      .update({ is_important: !current })
      .in('id', conversationIds);

    if (error) {
      console.error('Failed to toggle important:', error);
      toast.error('Failed to update conversation');
      return;
    }

    await fetchConversations();
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return {
    conversations,
    loading,
    totalUnread,
    getMessages,
    sendMessage,
    markRead,
    createConversation,
    toggleImportant,
    refetch: fetchConversations,
  };
}