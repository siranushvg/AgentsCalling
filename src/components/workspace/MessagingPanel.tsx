import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MessageChannel } from '@/types';

interface DbTemplate {
  id: string;
  name: string;
  content: string;
  channel: string;
}

interface DbMessage {
  id: string;
  content: string;
  channel: string;
  delivery_status: string;
  sent_at: string;
}

interface MessagingPanelProps {
  activeTab: MessageChannel;
  setActiveTab: (c: MessageChannel) => void;
  leadId?: string;
}

export function MessagingPanel({ activeTab, setActiveTab, leadId }: MessagingPanelProps) {
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [preview, setPreview] = useState('');

  // Fetch templates from DB
  useEffect(() => {
    setLoadingTemplates(true);
    supabase
      .from('templates')
      .select('id, name, content, channel')
      .eq('channel', activeTab)
      .eq('active', true)
      .order('name')
      .then(({ data }) => {
        setTemplates(data || []);
        setLoadingTemplates(false);
      });
    setSelectedTemplate('');
    setPreview('');
  }, [activeTab]);

  // Fetch messages for lead
  useEffect(() => {
    if (!leadId) { setMessages([]); return; }
    supabase
      .from('messages')
      .select('id, content, channel, delivery_status, sent_at')
      .eq('lead_id', leadId)
      .eq('channel', activeTab)
      .order('sent_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setMessages(data || []));
  }, [leadId, activeTab]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tpl = templates.find(t => t.id === templateId);
    setPreview(tpl?.content || '');
  };

  return (
    <div className="w-72 flex-shrink-0 rounded-lg border bg-card shadow-sm flex flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex gap-1">
          {(['whatsapp', 'sms', 'rcs'] as MessageChannel[]).map(ch => (
            <button
              key={ch}
              onClick={() => setActiveTab(ch)}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                activeTab === ch ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {ch.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className="rounded-lg bg-muted p-3">
            <p className="text-sm">{msg.content}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground">
                {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <StatusBadge variant={msg.delivery_status as any}>{msg.delivery_status}</StatusBadge>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No messages on {activeTab.toUpperCase()} yet</p>
            <p className="text-xs text-muted-foreground">Select a template below to send the first message</p>
          </div>
        )}
        {/* Template preview */}
        {preview && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-[10px] font-medium text-muted-foreground mb-1">Preview</p>
            <p className="text-xs">{preview}</p>
          </div>
        )}
      </div>
      <div className="border-t p-4 space-y-3">
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={selectedTemplate}
          onChange={(e) => handleTemplateChange(e.target.value)}
        >
          <option value="">Select template...</option>
          {loadingTemplates ? (
            <option disabled>Loading...</option>
          ) : (
            templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))
          )}
        </select>
        <Button className="w-full" size="sm" disabled={!selectedTemplate}>
          <Send className="h-4 w-4 mr-2" /> Send Message
        </Button>
      </div>
    </div>
  );
}
