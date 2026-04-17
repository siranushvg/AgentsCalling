import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { maskPhone } from '@/lib/maskPhone';
import {
  Search, Send, MessageSquare, Phone, Clock, Check, CheckCheck,
  AlertCircle, RefreshCw, FileText, Users, User, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

/* ── shared types & helpers ── */

interface WatiContact {
  id: string;
  wAid: string;
  firstName: string;
  lastName: string;
  phone: string;
  lastMessage?: string;
  lastMessageTime?: string;
}

interface WatiMessage {
  id: string;
  text: string;
  type: string;
  owner: boolean;
  statusString?: string;
  created: string;
  eventType?: string;
  data?: string;
}

interface WatiTemplate {
  id: string;
  elementName: string;
  body: string;
  status?: string;
  category?: string;
}

interface AgentSummary {
  agent_id: string;
  user_id: string;
  full_name: string;
  status: string;
  conversation_count: number;
  unread_count: number;
  last_message_at: string | null;
}

async function callWati(action: string, params?: Record<string, string>, body?: unknown) {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('Not authenticated');

  const qs = new URLSearchParams({ action, ...params });
  const opts: RequestInit = {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  };
  if (body) {
    opts.method = 'POST';
    opts.body = JSON.stringify(body);
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${baseUrl}/functions/v1/wati-proxy?${qs}`, opts);
  if (!res.ok) throw new Error(`WATI API error: ${res.status}`);
  return res.json();
}

function StatusIcon({ status }: { status?: string }) {
  if (!status) return <Clock className="h-3 w-3 text-muted-foreground" />;
  const s = status.toLowerCase();
  if (s === 'read') return <CheckCheck className="h-3 w-3 text-blue-500" />;
  if (s === 'delivered') return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  if (s === 'sent') return <Check className="h-3 w-3 text-muted-foreground" />;
  if (s === 'failed') return <AlertCircle className="h-3 w-3 text-destructive" />;
  return <Clock className="h-3 w-3 text-muted-foreground" />;
}

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

function getLeadPhoneLabel(phone: string) {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 6) return 'xxxxx•••••';
  const last5 = digits.slice(-5);
  return 'xxxxx' + last5;
}

function MediaImage({ src }: { src: string }) {
  const [error, setError] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sess = (await supabase.auth.getSession()).data.session;
      if (!sess || cancelled) return;
      try {
        const res = await fetch(src, {
          headers: {
            Authorization: `Bearer ${sess.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        if (!res.ok) { setError(true); return; }
        const blob = await res.blob();
        if (!cancelled) setImgSrc(URL.createObjectURL(blob));
      } catch { if (!cancelled) setError(true); }
    })();
    return () => { cancelled = true; };
  }, [src]);

  if (error) return <p className="text-xs italic opacity-70">📷 Image unavailable</p>;
  if (!imgSrc) return <Skeleton className="h-40 w-full rounded" />;
  return <img src={imgSrc} alt="Media" className="max-w-full rounded max-h-60 cursor-pointer" onClick={() => window.open(imgSrc, '_blank')} />;
}

function usePolling(callback: () => void | Promise<void>, delay: number, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const intervalId = window.setInterval(() => {
      void callback();
    }, delay);

    return () => window.clearInterval(intervalId);
  }, [callback, delay, enabled]);
}

/** Subscribe to realtime changes on whatsapp_messages for a conversation and trigger a refresh */
function useRealtimeMessages(conversationId: string | null, onNewMessage: () => void) {
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`wa-msgs-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => { void onNewMessage(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, onNewMessage]);
}

/** Subscribe to realtime changes on whatsapp_conversations for contact list refresh */
function useRealtimeConversations(onUpdate: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('wa-convos-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations',
        },
        () => { void onUpdate(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [onUpdate]);
}

/* ── Contact list + thread panel (shared between agent & admin-per-agent view) ── */

function ContactThreadView({
  contacts,
  loadingContacts,
  onRefreshContacts,
  search,
  setSearch,
  selectedContact,
  setSelectedContact,
  messages,
  loadingMessages,
  fetchMessages,
  templates,
  sending,
  handleSend,
  handleSendTemplate,
  messageText,
  setMessageText,
  showTemplates,
  setShowTemplates,
  messagesEndRef,
  headerExtra,
}: {
  contacts: WatiContact[];
  loadingContacts: boolean;
  onRefreshContacts: () => void;
  search: string;
  setSearch: (s: string) => void;
  selectedContact: WatiContact | null;
  setSelectedContact: (c: WatiContact | null) => void;
  messages: WatiMessage[];
  loadingMessages: boolean;
  fetchMessages: (phone: string, conversationId?: string) => void;
  templates: WatiTemplate[];
  sending: boolean;
  handleSend: () => void;
  handleSendTemplate: (t: WatiTemplate) => void;
  messageText: string;
  setMessageText: (s: string) => void;
  showTemplates: boolean;
  setShowTemplates: (b: boolean) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  headerExtra?: React.ReactNode;
}) {
  const filteredContacts = contacts.filter(c => {
    const q = search.toLowerCase();
    return !q || `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(q);
  });

  return (
    <>
      {/* Contact list */}
      <div className="w-72 flex-shrink-0 border-r flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            {headerExtra || (
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-green-600" />
                WhatsApp
              </h2>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefreshContacts} title="Refresh">
              <RefreshCw className={cn("h-3.5 w-3.5", loadingContacts && "animate-spin")} />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..." className="h-8 pl-8 text-xs" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {loadingContacts ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-36" /></div>
                </div>
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Phone className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No contacts found</p>
            </div>
          ) : (
            <div className="p-1">
              {filteredContacts.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                    selectedContact?.id === c.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                >
                  <div className="h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-400 text-xs font-bold flex-shrink-0">
                    {(c.firstName || c.phone)?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {(() => {
                        const name = c.firstName ? `${c.firstName} ${c.lastName}`.trim() : '';
                        const looksLikePhone = !name || /^\+?\d[\d\s-]{5,}$/.test(name);
                        return looksLikePhone ? maskPhone(c.phone || name) : name;
                      })()}
                    </p>
                    {c.lastMessage && <p className="text-[10px] text-muted-foreground truncate">{c.lastMessage}</p>}
                  </div>
                  {c.lastMessageTime && <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatTime(c.lastMessageTime)}</span>}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedContact ? (
          <>
            <div className="px-4 py-3 border-b flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-400 text-xs font-bold">
                {(selectedContact.firstName || selectedContact.phone)?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {(() => {
                    const name = selectedContact.firstName ? `${selectedContact.firstName} ${selectedContact.lastName}`.trim() : '';
                    const looksLikePhone = !name || /^\+?\d[\d\s-]{5,}$/.test(name);
                    return looksLikePhone ? maskPhone(selectedContact.phone || name) : name;
                  })()}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">{maskPhone(selectedContact.phone)}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => fetchMessages(selectedContact.phone, selectedContact.id)}>
                <RefreshCw className={cn("h-3 w-3", loadingMessages && "animate-spin")} /> Refresh
              </Button>
            </div>

            <ScrollArea className="flex-1 px-4 py-3">
              {loadingMessages ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                      <Skeleton className="h-10 w-48 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-2" />
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map(m => {
                    const isOutgoing = m.owner || m.eventType === 'sentMessage';
                    const msgText = m.text || m.data || '';
                    if (!msgText && m.eventType === 'ticketEvent') return null;
                    const isImage = m.type === 'image' || (m.data && /\.(jpg|jpeg|png|gif|webp)$/i.test(m.data));
                    const isVideo = m.type === 'video' || (m.data && /\.(mp4|3gp|mov)$/i.test(m.data));
                    const isDocument = m.type === 'document' || (m.data && /\.(pdf|doc|docx|xls|xlsx)$/i.test(m.data));
                    const hasMediaPath = m.data && /^data\/(images|videos|documents|media)\//.test(m.data);
                    const mediaUrl = hasMediaPath
                      ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wati-proxy?action=get_media&filePath=${encodeURIComponent(m.data!)}`
                      : null;

                    return (
                      <div key={m.id} className={cn("flex", isOutgoing ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[70%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                          isOutgoing ? "bg-green-600 text-white rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                        )}>
                          {(isImage || (hasMediaPath && !isVideo && !isDocument)) && mediaUrl ? (
                            <MediaImage src={mediaUrl} />
                          ) : isVideo && mediaUrl ? (
                            <video src={mediaUrl} controls className="max-w-full rounded max-h-60" />
                          ) : isDocument && mediaUrl ? (
                            <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2 underline", isOutgoing ? "text-green-100" : "text-primary")}>
                              <FileText className="h-4 w-4" /> {m.data?.split('/').pop() || 'Document'}
                            </a>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msgText}</p>
                          )}
                          {m.text && hasMediaPath && <p className="whitespace-pre-wrap break-words mt-1">{m.text}</p>}
                          <div className={cn("flex items-center gap-1 mt-1", isOutgoing ? "justify-end" : "justify-start")}>
                            <span className={cn("text-[9px]", isOutgoing ? "text-green-200" : "text-muted-foreground")}>{formatTime(m.created)}</span>
                            {isOutgoing && <StatusIcon status={m.statusString} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {showTemplates && (
              <div className="border-t max-h-48 overflow-y-auto">
                <div className="px-3 py-2 flex items-center justify-between border-b bg-muted/30">
                  <span className="text-xs font-medium">Select a Template to Send</span>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setShowTemplates(false)}>Close</Button>
                </div>
                {templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">No approved templates found</p>
                ) : (
                  <div className="p-1">
                    {templates.map(t => (
                      <button key={t.id} onClick={() => handleSendTemplate(t)} disabled={sending}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/50 transition-colors group">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium">{t.elementName}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{t.body}</p>
                          </div>
                          <Send className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="border-t p-3 flex items-center gap-2">
              <Button variant={showTemplates ? "default" : "ghost"} size="icon"
                className={cn("h-8 w-8 flex-shrink-0", showTemplates && "bg-green-600 hover:bg-green-700")}
                onClick={() => setShowTemplates(!showTemplates)} title="Send Template">
                <FileText className="h-4 w-4" />
              </Button>
              <Input value={messageText} onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a message..." className="h-8 text-xs flex-1" disabled={sending} />
              <Button size="icon" className="h-8 w-8 flex-shrink-0 bg-green-600 hover:bg-green-700"
                onClick={handleSend} disabled={!messageText.trim() || sending}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1">WhatsApp Messaging</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Select a contact to view the conversation.</p>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Admin Agent-wise WhatsApp View ── */

function AdminWhatsAppView() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentSummary | null>(null);
  const [agentSearch, setAgentSearch] = useState('');

  // Per-agent contact/thread state
  const [contacts, setContacts] = useState<WatiContact[]>([]);
  const [messages, setMessages] = useState<WatiMessage[]>([]);
  const [templates, setTemplates] = useState<WatiTemplate[]>([]);
  const [selectedContact, setSelectedContact] = useState<WatiContact | null>(null);
  const [search, setSearch] = useState('');
  const [messageText, setMessageText] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch agent list with conversation summaries
  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      // Get all agents
      const { data: agentRows } = await supabase
        .from('agents')
        .select('id, user_id, full_name, status')
        .in('status', ['active', 'training']);

      if (!agentRows) { setAgents([]); setLoadingAgents(false); return; }

      // Get conversation counts per agent via leads
      const { data: convos } = await supabase
        .from('whatsapp_conversations')
        .select('id, lead_id, unread_count, last_message_at');

      const { data: leads } = await supabase
        .from('leads')
        .select('id, assigned_agent_id');

      const leadAgentMap = new Map<string, string>();
      (leads || []).forEach(l => { if (l.assigned_agent_id) leadAgentMap.set(l.id, l.assigned_agent_id); });

      // Also check whatsapp_messages for agent_id to capture interaction-based ownership
      const { data: msgAgents } = await supabase
        .from('whatsapp_messages')
        .select('conversation_id, agent_id')
        .not('agent_id', 'is', null);

      const convoAgentFromMsg = new Map<string, string>();
      (msgAgents || []).forEach(m => { if (m.agent_id) convoAgentFromMsg.set(m.conversation_id, m.agent_id); });

      // Build per-agent summaries
      const agentMap = new Map<string, { count: number; unread: number; lastAt: string | null }>();
      agentRows.forEach(a => agentMap.set(a.id, { count: 0, unread: 0, lastAt: null }));

      (convos || []).forEach(c => {
        const agentId = (c.lead_id && leadAgentMap.get(c.lead_id)) || convoAgentFromMsg.get(c.id);
        if (!agentId || !agentMap.has(agentId)) return;
        const entry = agentMap.get(agentId)!;
        entry.count++;
        entry.unread += c.unread_count || 0;
        if (c.last_message_at && (!entry.lastAt || c.last_message_at > entry.lastAt)) {
          entry.lastAt = c.last_message_at;
        }
      });

      const summaries: AgentSummary[] = agentRows.map(a => {
        const s = agentMap.get(a.id)!;
        return {
          agent_id: a.id,
          user_id: a.user_id || '',
          full_name: a.full_name,
          status: a.status,
          conversation_count: s.count,
          unread_count: s.unread,
          last_message_at: s.lastAt,
        };
      }).sort((a, b) => {
        // Sort: those with conversations first, then by unread, then by last activity
        if (a.conversation_count === 0 && b.conversation_count > 0) return 1;
        if (a.conversation_count > 0 && b.conversation_count === 0) return -1;
        if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count;
        if (a.last_message_at && b.last_message_at) return b.last_message_at.localeCompare(a.last_message_at);
        return a.full_name.localeCompare(b.full_name);
      });

      setAgents(summaries);
    } catch (err) {
      console.error('Failed to fetch agent summaries:', err);
      toast.error('Failed to load agent list');
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  // When an agent is selected, fetch their contacts from WATI (all contacts) then filter by their leads
  const fetchAgentContacts = useCallback(async (agent: AgentSummary) => {
    setLoadingContacts(true);
    setSelectedContact(null);
    setMessages([]);
    try {
      // Get leads assigned to this agent
      const { data: agentLeads } = await supabase
        .from('leads')
        .select('id, phone_number, username')
        .eq('assigned_agent_id', agent.agent_id);

      // Get conversations linked to those leads
      const leadIds = (agentLeads || []).map(l => l.id);
      const leadPhones = new Set((agentLeads || []).map(l => l.phone_number.replace(/\D/g, '').slice(-10)));

      // Also get conversations where the agent sent messages
      const { data: agentMsgConvos } = await supabase
        .from('whatsapp_messages')
        .select('conversation_id')
        .eq('agent_id', agent.agent_id);
      const agentConvoIds = new Set((agentMsgConvos || []).map(m => m.conversation_id));

      // Get all relevant whatsapp conversations
      let convoQuery = supabase.from('whatsapp_conversations').select('*');
      const { data: allConvos } = await convoQuery;

      const relevantConvos = (allConvos || []).filter(c =>
        (c.lead_id && leadIds.includes(c.lead_id)) ||
        agentConvoIds.has(c.id) ||
        leadPhones.has(c.phone_number.replace(/\D/g, '').slice(-10))
      );

      const contactList: WatiContact[] = relevantConvos.map(c => ({
        id: c.id,
        wAid: c.wa_id,
        firstName: c.display_name || '',
        lastName: '',
        phone: c.phone_number,
        lastMessage: c.last_message_text || '',
        lastMessageTime: c.last_message_at || '',
      }));

      // If no DB conversations, try WATI API contacts filtered by agent's lead phones
      if (contactList.length === 0 && leadPhones.size > 0) {
        try {
          const data = await callWati('get_contacts');
          const list = data?.contact_list || data?.contacts || [];
          const mapped = list.map((c: any) => ({
            id: c.id || c.wAid || c.phone,
            wAid: c.wAid || c.wa_id || c.phone || '',
            firstName: c.firstName || c.first_name || c.display_name || '',
            lastName: c.lastName || c.last_name || '',
            phone: c.phone || c.wAid || c.wa_id || '',
            lastMessage: c.lastMessage?.text || c.lastMessage || '',
            lastMessageTime: c.lastMessage?.created || c.lastMessageTime || '',
          }));
          const filtered = mapped.filter((c: WatiContact) => {
            const norm = c.phone.replace(/\D/g, '').slice(-10);
            return leadPhones.has(norm);
          });
          setContacts(filtered);
        } catch { setContacts([]); }
      } else {
        setContacts(contactList);
      }
    } catch (err) {
      console.error('Failed to fetch agent contacts:', err);
      toast.error('Failed to load agent conversations');
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const fetchMessages = useCallback(async (phone: string, _conversationId?: string) => {
    setLoadingMessages(true);
    try {
      const params: Record<string, string> = { whatsappNumber: phone };
      if (_conversationId) params.conversationId = _conversationId;

      const data = await callWati('get_messages', params);
      const items = data?.messages?.items || data?.messages || [];
      const sorted = [...items].sort(
        (a: any, b: any) => new Date(a.created || a.timestamp).getTime() - new Date(b.created || b.timestamp).getTime()
      );
      setMessages(sorted.map((m: any) => ({
        id: m.id || m.messageId || `${m.created}-${Math.random()}`,
        text: m.text || m.finalText || m.data || m.message || '',
        type: m.type || 'text',
        owner: m.owner ?? m.isOwner ?? (m.eventType === 'sentMessage'),
        statusString: m.statusString || m.status || '',
        created: m.created || m.timestamp || '',
        eventType: m.eventType,
        data: m.data,
      })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      toast.error('Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await callWati('get_templates');
      const list = data?.messageTemplates || [];
      setTemplates(list.filter((t: any) => t.status === 'APPROVED' || !t.status).map((t: any) => ({
        id: t.id,
        elementName: t.elementName || t.element_name || t.name || '',
        body: t.body || t.bodyOriginal || '',
        status: t.status,
        category: t.category,
      })));
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  useEffect(() => {
    if (selectedContact?.phone) fetchMessages(selectedContact.phone);
  }, [selectedContact, fetchMessages]);

  useEffect(() => {
    if (selectedAgent) fetchAgentContacts(selectedAgent);
  }, [selectedAgent, fetchAgentContacts]);

  usePolling(fetchAgents, 30000, true);
  usePolling(() => {
    if (!selectedAgent) return;
    return fetchAgentContacts(selectedAgent);
  }, 30000, !!selectedAgent);
  usePolling(() => {
    if (!selectedContact) return;
    return fetchMessages(selectedContact.phone, selectedContact.id);
  }, 20000, !!selectedContact);

  // Realtime: instant updates
  useRealtimeConversations(useCallback(() => {
    fetchAgents();
    if (selectedAgent) fetchAgentContacts(selectedAgent);
  }, [fetchAgents, fetchAgentContacts, selectedAgent]));
  useRealtimeMessages(selectedContact?.id ?? null, useCallback(() => {
    if (selectedContact?.phone) fetchMessages(selectedContact.phone, selectedContact.id);
  }, [selectedContact, fetchMessages]));

  const handleSend = async () => {
    if (!messageText.trim() || !selectedContact) return;
    const text = messageText.trim();
    setSending(true);
    try {
      await callWati('send_message', {}, { whatsappNumber: selectedContact.phone, message: text });
      const optimisticMsg: WatiMessage = {
        id: `optimistic-${Date.now()}`, text, type: 'text', owner: true,
        statusString: 'sent', created: new Date().toISOString(), eventType: 'sentMessage',
      };
      setMessages(prev => [...prev, optimisticMsg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      setMessageText('');
      toast.success('Message sent');
      setTimeout(() => { if (selectedContact?.phone) fetchMessages(selectedContact.phone); }, 3000);
    } catch { toast.error('Failed to send message'); }
    finally { setSending(false); }
  };

  const handleSendTemplate = async (template: WatiTemplate) => {
    if (!selectedContact) return;
    setSending(true);
    try {
      await callWati('send_template', {}, {
        whatsappNumber: selectedContact.phone, templateName: template.elementName,
        broadcastName: `admin_${Date.now()}`, parameters: [],
      });
      const optimisticMsg: WatiMessage = {
        id: `optimistic-${Date.now()}`,
        text: `[Template: ${template.elementName}]\n${template.body || ''}`.trim(),
        type: 'text', owner: true, statusString: 'sent',
        created: new Date().toISOString(), eventType: 'sentMessage',
      };
      setMessages(prev => [...prev, optimisticMsg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      toast.success('Template sent');
      setShowTemplates(false);
      setTimeout(() => { if (selectedContact?.phone) fetchMessages(selectedContact.phone); }, 3000);
    } catch { toast.error('Failed to send template'); }
    finally { setSending(false); }
  };

  const filteredAgents = agents.filter(a => {
    const q = agentSearch.toLowerCase();
    return !q || a.full_name.toLowerCase().includes(q);
  });

  const totalConvos = agents.reduce((s, a) => s + a.conversation_count, 0);
  const totalUnread = agents.reduce((s, a) => s + a.unread_count, 0);

  return (
    <div className="flex h-[calc(100vh-8rem)] -mt-2 gap-0 rounded-lg border bg-card overflow-hidden shadow-sm">
      {/* LEFT: Agent list */}
      <div className="w-64 flex-shrink-0 border-r flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              Agents
            </h2>
            <div className="flex items-center gap-1">
              {totalUnread > 0 && (
                <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{totalUnread}</Badge>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchAgents} title="Refresh">
                <RefreshCw className={cn("h-3.5 w-3.5", loadingAgents && "animate-spin")} />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={agentSearch} onChange={e => setAgentSearch(e.target.value)} placeholder="Search agents..." className="h-8 pl-8 text-xs" />
          </div>
          <p className="text-[10px] text-muted-foreground">{totalConvos} conversations across {agents.length} agents</p>
        </div>

        <ScrollArea className="flex-1">
          {loadingAgents ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-16" /></div>
                </div>
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <User className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No agents found</p>
            </div>
          ) : (
            <div className="p-1">
              {filteredAgents.map(a => (
                <button
                  key={a.agent_id}
                  onClick={() => { setSelectedAgent(a); setSelectedContact(null); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                    selectedAgent?.agent_id === a.agent_id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                    {a.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate">{a.full_name}</p>
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full flex-shrink-0",
                        a.status === 'active' ? "bg-green-500" : "bg-amber-500"
                      )} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{a.conversation_count} chats</span>
                      {a.last_message_at && <span>· {formatTime(a.last_message_at)}</span>}
                    </div>
                  </div>
                  {a.unread_count > 0 && (
                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5 flex-shrink-0">{a.unread_count}</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* MIDDLE + RIGHT: Contact list + Thread for selected agent */}
      {selectedAgent ? (
        <ContactThreadView
          contacts={contacts}
          loadingContacts={loadingContacts}
          onRefreshContacts={() => fetchAgentContacts(selectedAgent)}
          search={search}
          setSearch={setSearch}
          selectedContact={selectedContact}
          setSelectedContact={setSelectedContact}
          messages={messages}
          loadingMessages={loadingMessages}
          fetchMessages={fetchMessages}
          templates={templates}
          sending={sending}
          handleSend={handleSend}
          handleSendTemplate={handleSendTemplate}
          messageText={messageText}
          setMessageText={setMessageText}
          showTemplates={showTemplates}
          setShowTemplates={setShowTemplates}
          messagesEndRef={messagesEndRef}
          headerExtra={
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => { setSelectedAgent(null); setSelectedContact(null); }}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <p className="text-xs font-semibold truncate">{selectedAgent.full_name}'s Chats</p>
            </div>
          }
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Agent WhatsApp Overview</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Select an agent from the left to view and manage their WhatsApp conversations.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Agent's own WhatsApp View (unchanged logic) ── */

function AgentOwnWhatsAppView() {
  const [contacts, setContacts] = useState<WatiContact[]>([]);
  const [messages, setMessages] = useState<WatiMessage[]>([]);
  const [templates, setTemplates] = useState<WatiTemplate[]>([]);
  const [selectedContact, setSelectedContact] = useState<WatiContact | null>(null);
  const [search, setSearch] = useState('');
  const [messageText, setMessageText] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      // Use agent-scoped endpoint: only returns active chats the agent is allowed to access
      const data = await callWati('get_agent_contacts');
      const list = data?.contact_list || [];
      const mapped = list
        .map((c: any) => {
          const phone = c.phone || c.wAid || c.wa_id || '';
          return {
            id: c.id || c.conversation_id || c.wAid || phone,
            wAid: c.wAid || c.wa_id || phone,
            firstName: getLeadPhoneLabel(phone),
            lastName: '',
            phone,
            lastMessage: typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.text || ''),
            lastMessageTime: c.lastMessageTime || c.lastMessage?.created || '',
          };
        })
        .sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime());

      setContacts(mapped);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
      toast.error('Failed to load WhatsApp contacts');
    } finally { setLoadingContacts(false); }
  }, []);

  const fetchMessages = useCallback(async (phone: string, conversationId?: string) => {
    setLoadingMessages(true);
    try {
      const params: Record<string, string> = { whatsappNumber: phone };
      if (conversationId) params.conversationId = conversationId;

      const data = await callWati('get_messages', params);
      const items = data?.messages?.items || data?.messages || [];
      const sorted = [...items].sort(
        (a: any, b: any) => new Date(a.created || a.timestamp).getTime() - new Date(b.created || b.timestamp).getTime()
      );
      setMessages(sorted.map((m: any) => ({
        id: m.id || m.messageId || `${m.created}-${Math.random()}`,
        text: m.text || m.finalText || m.data || m.message || '',
        type: m.type || 'text',
        owner: m.owner ?? m.isOwner ?? (m.eventType === 'sentMessage'),
        statusString: m.statusString || m.status || '',
        created: m.created || m.timestamp || '',
        eventType: m.eventType,
        data: m.data,
      })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      toast.error('Failed to load messages');
    } finally { setLoadingMessages(false); }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await callWati('get_templates');
      const list = data?.messageTemplates || [];
      setTemplates(list.filter((t: any) => t.status === 'APPROVED' || !t.status).map((t: any) => ({
        id: t.id,
        elementName: t.elementName || t.element_name || t.name || '',
        body: t.body || t.bodyOriginal || '',
        status: t.status,
        category: t.category,
      })));
    } catch (err) { console.error('Failed to fetch templates:', err); }
  }, []);

  useEffect(() => { fetchContacts(); fetchTemplates(); }, [fetchContacts, fetchTemplates]);
  useEffect(() => {
    if (selectedContact?.phone) fetchMessages(selectedContact.phone, selectedContact.id);
  }, [selectedContact, fetchMessages]);

  usePolling(fetchContacts, 30000, true);
  usePolling(() => {
    if (!selectedContact) return;
    return fetchMessages(selectedContact.phone, selectedContact.id);
  }, 20000, !!selectedContact);

  // Realtime: instant updates
  useRealtimeConversations(fetchContacts);
  useRealtimeMessages(selectedContact?.id ?? null, useCallback(() => {
    if (selectedContact?.phone) fetchMessages(selectedContact.phone, selectedContact.id);
  }, [selectedContact, fetchMessages]));

  const handleSend = async () => {
    if (!messageText.trim() || !selectedContact) return;
    const text = messageText.trim();
    setSending(true);
    try {
      await callWati('send_message', {}, { whatsappNumber: selectedContact.phone, message: text });
      setMessages(prev => [...prev, {
        id: `optimistic-${Date.now()}`, text, type: 'text', owner: true,
        statusString: 'sent', created: new Date().toISOString(), eventType: 'sentMessage',
      }]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      setMessageText('');
      toast.success('Message sent');
      setTimeout(() => { if (selectedContact?.phone) fetchMessages(selectedContact.phone, selectedContact.id); }, 3000);
    } catch { toast.error('Failed to send message'); }
    finally { setSending(false); }
  };

  const handleSendTemplate = async (template: WatiTemplate) => {
    if (!selectedContact) return;
    setSending(true);
    try {
      await callWati('send_template', {}, {
        whatsappNumber: selectedContact.phone, templateName: template.elementName,
        broadcastName: `agent_${Date.now()}`, parameters: [],
      });
      setMessages(prev => [...prev, {
        id: `optimistic-${Date.now()}`,
        text: `[Template: ${template.elementName}]\n${template.body || ''}`.trim(),
        type: 'text', owner: true, statusString: 'sent',
        created: new Date().toISOString(), eventType: 'sentMessage',
      }]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      toast.success('Template sent');
      setShowTemplates(false);
      setTimeout(() => { if (selectedContact?.phone) fetchMessages(selectedContact.phone, selectedContact.id); }, 3000);
    } catch { toast.error('Failed to send template'); }
    finally { setSending(false); }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] -mt-2 gap-0 rounded-lg border bg-card overflow-hidden shadow-sm">
      <ContactThreadView
        contacts={contacts}
        loadingContacts={loadingContacts}
        onRefreshContacts={fetchContacts}
        search={search}
        setSearch={setSearch}
        selectedContact={selectedContact}
        setSelectedContact={setSelectedContact}
        messages={messages}
        loadingMessages={loadingMessages}
        fetchMessages={fetchMessages}
        templates={templates}
        sending={sending}
        handleSend={handleSend}
        handleSendTemplate={handleSendTemplate}
        messageText={messageText}
        setMessageText={setMessageText}
        showTemplates={showTemplates}
        setShowTemplates={setShowTemplates}
        messagesEndRef={messagesEndRef}
      />
    </div>
  );
}

/* ── Main export: role-based routing ── */

export default function AgentWhatsApp() {
  const { role } = useAuth();
  if (role === 'admin') return <AdminWhatsAppView />;
  return <AgentOwnWhatsAppView />;
}
