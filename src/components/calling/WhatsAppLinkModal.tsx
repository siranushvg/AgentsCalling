import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, Send, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WhatsAppLinkModalProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  maskedPhone: string;
}

const WEBSITE_URL = 'bluesparrowwork.com';

const PREDEFINED_MESSAGES = [
  {
    label: 'Website Link',
    text: `Hello, here is the website link: ${WEBSITE_URL}`,
  },
  {
    label: 'Continue Here',
    text: `Hi, please continue here: ${WEBSITE_URL}`,
  },
  {
    label: 'Access Website',
    text: `You can access the website here: ${WEBSITE_URL}`,
  },
];

export function WhatsAppLinkModal({
  open, onClose, leadId, leadName, maskedPhone,
}: WhatsAppLinkModalProps) {
  const [sending, setSending] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    const message = PREDEFINED_MESSAGES[selectedIdx].text;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wati-proxy?action=send_message_to_lead`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadId, message }),
      });
      const result = await resp.json();

      if (resp.ok && !result.error) {
        toast.success(`Website link sent to ${maskedPhone}`);
        setSent(true);
        setTimeout(() => { setSent(false); onClose(); }, 1500);
      } else {
        toast.error(result.error || 'Failed to send link');
      }
    } catch {
      toast.error('Failed to send WhatsApp link');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setSent(false); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-success" />
            Send Website Link
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
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

          {/* Message options */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Choose message</p>
            {PREDEFINED_MESSAGES.map((msg, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIdx(idx)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 text-xs transition-all ${
                  selectedIdx === idx
                    ? 'border-success bg-success/5 ring-1 ring-success/30'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                <p className="font-medium text-foreground mb-0.5">{msg.label}</p>
                <p className="text-muted-foreground leading-relaxed">{msg.text}</p>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || sent}
            className="bg-success hover:bg-success/90 text-success-foreground"
          >
            {sent ? (
              <><Check className="h-4 w-4 mr-2" /> Sent!</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> {sending ? 'Sending...' : 'Send Link'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
