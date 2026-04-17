import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Send, Clock, Check, CheckCheck, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { maskPhone } from '@/lib/maskPhone';
import { cn } from '@/lib/utils';

interface WhatsAppMessageModalProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  maskedPhone: string;
}

interface MessageHistoryItem {
  id: string;
  direction: string;
  message_text: string | null;
  template_name: string | null;
  status: string;
  created_at: string;
}

type SendMode = 'session' | 'template';

interface WatiTemplate {
  elementName: string;
  category?: string;
  status?: string;
}

export function WhatsAppMessageModal({
  open, onClose, leadId, leadName, maskedPhone,
}: WhatsAppMessageModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<SendMode>('session');
  const [templates, setTemplates] = useState<WatiTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [history, setHistory] = useState<MessageHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load message history for this lead
  useEffect(() => {
    if (!open || !leadId) return;
    loadHistory();
  }, [open, leadId]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('whatsapp_messages')
        .select('id, direction, message_text, template_name, status, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(20);
      setHistory(data || []);
    } catch { /* ignore */ } finally {
      setLoadingHistory(false);
    }
  };

  // Load templates
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wati-proxy?action=get_templates`;
        const resp = await fetch(url, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        const tplData = await resp.json();
        if (tplData?.messageTemplates) {
          setTemplates(
            tplData.messageTemplates
              .filter((t: any) => t.status === 'APPROVED')
              .slice(0, 30)
          );
        }
      } catch { /* ignore */ }
    })();
  }, [open]);

  const handleSend = async () => {
    if (mode === 'session' && !message.trim()) return;
    if (mode === 'template' && !selectedTemplate) return;

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const action = mode === 'template' ? 'send_template_to_lead' : 'send_message_to_lead';
      const body: Record<string, unknown> = { leadId };

      if (mode === 'session') {
        body.message = message.trim();
      } else {
        body.templateName = selectedTemplate;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wati-proxy?action=${action}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const result = await resp.json();

      if (resp.ok && !result.error) {
        toast.success(`WhatsApp message sent to ${maskedPhone}`);
        setMessage('');
        setSelectedTemplate('');
        loadHistory();
      } else {
        const errMsg = result.validWhatsAppNumber === false
          ? 'Number is not a valid WhatsApp number — message was NOT delivered'
          : (result.error || 'Failed to send message');
        toast.error(errMsg);
      }
    } catch {
      toast.error('Failed to send WhatsApp message');
    } finally {
      setSending(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'read': return <CheckCheck className="h-3 w-3 text-info" />;
      case 'delivered': return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'sent': return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'failed': return <AlertCircle className="h-3 w-3 text-destructive" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-success" />
            WhatsApp Message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-muted/30">
            <div>
              <p className="text-sm font-medium">{leadName}</p>
              <p className="text-xs text-muted-foreground font-mono">{maskedPhone}</p>
            </div>
            <Badge variant="outline" className="text-[10px] text-success border-success">
              WhatsApp
            </Badge>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'session' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('session')}
              className="flex-1 text-xs"
            >
              Message
            </Button>
            <Button
              variant={mode === 'template' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('template')}
              className="flex-1 text-xs"
            >
              Template
            </Button>
          </div>

          {/* Compose area */}
          {mode === 'session' ? (
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your WhatsApp message..."
              rows={3}
              maxLength={1000}
              className="resize-none"
            />
          ) : (
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Select approved template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.elementName} value={t.elementName}>
                    {t.elementName}
                  </SelectItem>
                ))}
                {templates.length === 0 && (
                  <SelectItem value="_none" disabled>No approved templates</SelectItem>
                )}
              </SelectContent>
            </Select>
          )}

          {/* Message history */}
          {history.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground">Recent Messages</p>
              {history.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs',
                    msg.direction === 'outgoing'
                      ? 'bg-success/10 ml-6'
                      : 'bg-blue-50 dark:bg-blue-950/30 mr-6'
                  )}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {msg.direction === 'incoming' ? '← Customer' : '→ You'}
                    </span>
                  </div>
                  <p className="text-foreground">
                    {msg.template_name ? `[Template: ${msg.template_name}]` : msg.message_text}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                    <span>{new Date(msg.created_at).toLocaleString()}</span>
                    {msg.direction === 'outgoing' && statusIcon(msg.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || (mode === 'session' ? !message.trim() : !selectedTemplate)}
            className="bg-success hover:bg-success/90 text-success-foreground"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
