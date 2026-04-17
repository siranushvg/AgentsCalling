import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Send, AlertCircle, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SmsMessageModalProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  maskedPhone: string;
}

interface SmsHistoryItem {
  id: string;
  content: string;
  status: string;
  provider_reason: string | null;
  created_at: string;
}

type ComposeMode = 'freetext' | 'template';

export function SmsMessageModal({
  open, onClose, leadId, leadName, maskedPhone,
}: SmsMessageModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<ComposeMode>('freetext');
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [history, setHistory] = useState<SmsHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load SMS history
  useEffect(() => {
    if (!open || !leadId) return;
    loadHistory();
  }, [open, leadId]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('sms_messages')
        .select('id, content, status, provider_reason, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(20);
      setHistory(data || []);
    } catch { /* ignore */ } finally {
      setLoadingHistory(false);
    }
  };

  // Load SMS templates from templates table
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('templates')
          .select('id, name, content')
          .eq('channel', 'sms')
          .eq('active', true)
          .order('name');
        setTemplates(data || []);
      } catch { /* ignore */ }
    })();
  }, [open]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tpl = templates.find(t => t.id === templateId);
    if (tpl) setMessage(tpl.content);
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadId, content: message.trim() }),
      });
      const result = await resp.json();

      if (resp.ok && result.success) {
        toast.success(`SMS sent to ${maskedPhone}`);
        setMessage('');
        setSelectedTemplate('');
        loadHistory();
      } else {
        toast.error(result.error || 'Failed to send SMS');
      }
    } catch {
      toast.error('Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Send SMS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-muted/30">
            <div>
              <p className="text-sm font-medium">{leadName}</p>
              <p className="text-xs text-muted-foreground font-mono">{maskedPhone}</p>
            </div>
            <Badge variant="outline" className="text-[10px] text-primary border-primary">
              SMS
            </Badge>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'freetext' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('freetext')}
              className="flex-1 text-xs"
            >
              Free Text
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

          {/* Template selector */}
          {mode === 'template' && (
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select SMS template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
                {templates.length === 0 && (
                  <SelectItem value="_none" disabled>No SMS templates</SelectItem>
                )}
              </SelectContent>
            </Select>
          )}

          {/* Message compose */}
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your SMS message..."
            rows={3}
            maxLength={1000}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{message.length}/1000</p>

          {/* SMS history */}
          {history.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground">Recent SMS</p>
              {history.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-lg px-3 py-2 text-xs bg-primary/5 ml-6"
                >
                  <p className="text-foreground">{msg.content}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                    <span>{new Date(msg.created_at).toLocaleString()}</span>
                    {msg.status === 'sent' ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-destructive" />
                    )}
                    {msg.status === 'failed' && msg.provider_reason && (
                      <span className="text-destructive">{msg.provider_reason}</span>
                    )}
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
            disabled={sending || !message.trim()}
          >
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {sending ? 'Sending...' : 'Send SMS'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
