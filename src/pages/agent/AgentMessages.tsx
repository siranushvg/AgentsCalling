import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInternalMessaging, type InternalMessage, type Conversation, MESSAGE_CATEGORIES, CATEGORY_LABELS, type MessageCategory } from '@/hooks/useInternalMessaging';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Send, MessageSquare, Search, Star, StarOff, Plus, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export default function AgentMessages() {
  const { user } = useAuth();
  const { conversations, loading, getMessages, sendMessage, markRead, createConversation, toggleImportant } = useInternalMessaging();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [newCategory, setNewCategory] = useState<MessageCategory>('general');
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const activeConvo = conversations.find(c => c.id === activeId);

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.participants.some(p => p.full_name.toLowerCase().includes(q)) ||
      c.last_message?.content.toLowerCase().includes(q) ||
      CATEGORY_LABELS[c.category]?.toLowerCase().includes(q);
  });

  // Group filtered conversations by category
  const uniqueCategories = useMemo(() => {
    const cats = new Set(filtered.map(c => c.category));
    return Array.from(cats);
  }, [filtered]);

  const needsGrouping = uniqueCategories.length > 1;

  const groupedByCategory = useMemo(() => {
    if (!needsGrouping) return null;
    const groups: Record<string, Conversation[]> = {};
    for (const convo of filtered) {
      if (!groups[convo.category]) groups[convo.category] = [];
      groups[convo.category].push(convo);
    }
    return groups;
  }, [filtered, needsGrouping]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  useEffect(() => {
    if (!activeId) return;
    setMsgLoading(true);
    getMessages(activeId).then(m => {
      setMessages(m);
      setMsgLoading(false);
      markRead(activeId);
    });
  }, [activeId, conversations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Realtime message updates for active conversation
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`msg-${activeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'internal_messages',
        filter: `conversation_id=eq.${activeId}`,
      }, (payload) => {
        const newMsg = payload.new as InternalMessage;
        setMessages(prev => [...prev, newMsg]);
        markRead(activeId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId]);

  const handleSend = async () => {
    if (!input.trim() || !activeId || !user) return;
    const content = input.trim();
    setInput('');
    // Optimistic update
    const optimistic: InternalMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeId,
      sender_id: user.id,
      sender_role: 'agent',
      content,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages(prev => [...prev, optimistic]);
    const success = await sendMessage(activeId, content);
    if (success) {
      const updated = await getMessages(activeId);
      setMessages(updated);
    } else {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(content);
    }
  };

  const handleNewConversation = async () => {
    if (!newMsg.trim()) return;
    setCreating(true);

    try {
      // Find an admin to message
      const { data: adminRoles, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1);

      if (roleError || !adminRoles?.length) {
        toast.error('Could not find an admin to message');
        setCreating(false);
        return;
      }

      const convoId = await createConversation(adminRoles[0].user_id, 'admin', newCategory, newMsg.trim());
      if (convoId) {
        toast.success('Message sent to Admin');
        setShowNew(false);
        setNewMsg('');
        setNewCategory('general');
        setActiveId(convoId);
      } else {
        toast.error('Failed to send message. Please try again.');
      }
    } catch (err) {
      console.error('New conversation error:', err);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const otherParticipant = (convo: Conversation) =>
    convo.participants.find(p => p.role === 'admin') ?? convo.participants.find(p => p.user_id !== user?.id);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 -mt-2 rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* LEFT: Conversation List */}
      <div className={cn("w-80 flex-shrink-0 border-r flex flex-col", activeId && "hidden md:flex")}>
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Admin Messages</h2>
            <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-8 text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">No admin messages yet</p>
              <p className="text-xs text-muted-foreground">Use this space to contact Admin for support, shift questions, or important updates.</p>
            </div>
          ) : needsGrouping && groupedByCategory ? (
            <div>
              {Object.entries(groupedByCategory).map(([cat, convos]) => {
                const catUnread = convos.reduce((s, c) => s + c.unread_count, 0);
                const isOpen = !collapsedCategories.has(cat);
                return (
                  <Collapsible key={cat} open={isOpen} onOpenChange={() => toggleCategory(cat)}>
                    <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-2 bg-muted/50 border-b hover:bg-muted transition-colors">
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="text-xs font-semibold">{CATEGORY_LABELS[cat] || cat}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{convos.length}</Badge>
                      </div>
                      {catUnread > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground px-1">
                          {catUnread}
                        </span>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="divide-y">
                        {convos.map(convo => {
                          const other = otherParticipant(convo);
                          return (
                            <button
                              key={convo.id}
                              onClick={() => setActiveId(convo.id)}
                              className={cn(
                                "w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors",
                                activeId === convo.id && "bg-accent"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium truncate">{other?.full_name || 'Admin'}</span>
                                    {convo.is_important && <Star className="h-3 w-3 text-warning fill-warning" />}
                                  </div>
                                  {convo.last_message && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.last_message.content}</p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  {convo.last_message && (
                                    <span className="text-[10px] text-muted-foreground">{formatMsgTime(convo.last_message.created_at)}</span>
                                  )}
                                  {convo.unread_count > 0 && (
                                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1.5">
                                      {convo.unread_count}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(convo => {
                const other = otherParticipant(convo);
                return (
                  <button
                    key={convo.id}
                    onClick={() => setActiveId(convo.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors",
                      activeId === convo.id && "bg-accent"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{other?.full_name || 'Admin'}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">{other?.role || 'admin'}</Badge>
                          {convo.is_important && <Star className="h-3 w-3 text-warning fill-warning" />}
                        </div>
                        {convo.last_message && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.last_message.content}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{CATEGORY_LABELS[convo.category]}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {convo.last_message && (
                          <span className="text-[10px] text-muted-foreground">{formatMsgTime(convo.last_message.created_at)}</span>
                        )}
                        {convo.unread_count > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1.5">
                            {convo.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* CENTER: Thread */}
      <div className={cn("flex-1 flex flex-col min-w-0", !activeId && "hidden md:flex")}>
        {activeConvo ? (
          <>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveId(null)} className="md:hidden text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{otherParticipant(activeConvo)?.full_name || 'Admin'}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{otherParticipant(activeConvo)?.role}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABELS[activeConvo.category]}</Badge>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleImportant(activeConvo.id, activeConvo.is_important)}
              >
                {activeConvo.is_important
                  ? <Star className="h-4 w-4 text-warning fill-warning" />
                  : <StarOff className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>

            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-3 max-w-2xl mx-auto">
                {msgLoading ? (
                  <div className="text-center py-8">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Start the conversation below.</p>
                ) : (
                  messages.map((msg, idx) => {
                    const isMine = msg.sender_id === user?.id;
                    const msgDate = new Date(msg.created_at);
                    const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at) : null;
                    const showDateSep = !prevDate || format(msgDate, 'yyyy-MM-dd') !== format(prevDate, 'yyyy-MM-dd');
                    return (
                      <React.Fragment key={msg.id}>
                        {showDateSep && (
                          <div className="flex items-center justify-center my-3">
                            <span className="text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                              {isToday(msgDate) ? 'Today' : isYesterday(msgDate) ? 'Yesterday' : format(msgDate, 'EEE, MMM d, yyyy')}
                            </span>
                          </div>
                        )}
                        <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "rounded-xl px-4 py-2.5 max-w-[75%] space-y-1",
                            isMine
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted rounded-bl-sm"
                          )}>
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                            <div className={cn("flex items-center gap-2 text-[10px]", isMine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                              <span>{format(msgDate, 'h:mm a')}</span>
                              {msg.read_at && isMine && <span>· Read</span>}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <div className="flex gap-2 max-w-2xl mx-auto">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                />
                <Button onClick={handleSend} disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 p-8">
            <MessageSquare className="h-10 w-10 text-muted-foreground/20" />
            <p className="font-medium text-muted-foreground">Select a conversation</p>
            <p className="text-xs text-muted-foreground max-w-xs">Choose a conversation from the list or start a new one to contact Admin.</p>
          </div>
        )}
      </div>

      {/* New conversation dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Message to Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm">Category</Label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value as MessageCategory)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {MESSAGE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Message</Label>
              <Textarea
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder="Describe your question or issue..."
                className="min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button onClick={handleNewConversation} disabled={!newMsg.trim() || creating}>
                {creating ? 'Sending...' : 'Send Message'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
