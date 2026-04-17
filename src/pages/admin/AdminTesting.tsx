import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, MessageSquare, Phone, CheckCircle, XCircle, Clock, Loader2, FileText } from 'lucide-react';

interface TestResult {
  channel: string;
  number: string;
  status: 'success' | 'error';
  message: string;
  timestamp: string;
  templateName?: string;
  raw?: unknown;
}

interface SmsTemplate {
  id: string;
  name: string;
  content: string;
}

interface WatiTemplate {
  elementName: string;
  category?: string;
  status?: string;
}

type Channel = 'sms' | 'whatsapp';

export default function AdminTesting() {
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<Channel>('sms');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  

  // SMS templates from DB
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [selectedSmsTemplate, setSelectedSmsTemplate] = useState('');

  // WhatsApp templates from WATI
  const [waTemplates, setWaTemplates] = useState<WatiTemplate[]>([]);
  const [selectedWaTemplate, setSelectedWaTemplate] = useState('');

  const addResult = (r: TestResult) => setResults((prev) => [r, ...prev].slice(0, 20));

  // Load SMS templates
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('templates')
          .select('id, name, content')
          .eq('channel', 'sms')
          .eq('active', true)
          .order('name');
        setSmsTemplates(data || []);
      } catch { /* ignore */ }
    })();
  }, []);

  // Load WhatsApp templates
  useEffect(() => {
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
          setWaTemplates(
            tplData.messageTemplates
              .filter((t: any) => t.status === 'APPROVED')
              .slice(0, 50)
          );
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Reset template selection when channel changes
  useEffect(() => {
    setSelectedSmsTemplate('');
    setSelectedWaTemplate('');
  }, [channel]);

  const selectedTemplateName = channel === 'sms'
    ? smsTemplates.find(t => t.id === selectedSmsTemplate)?.name || ''
    : selectedWaTemplate;

  const selectedTemplateContent = channel === 'sms'
    ? smsTemplates.find(t => t.id === selectedSmsTemplate)?.content || ''
    : '';

  const isTemplateSelected = channel === 'sms'
    ? !!selectedSmsTemplate
    : !!selectedWaTemplate;

  const handleSend = async () => {
    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }
    if (!isTemplateSelected) {
      toast.error('Please select a template');
      return;
    }

    setSending(true);

    if (channel === 'sms') {
      await handleSendSms();
    } else {
      await handleSendWhatsApp();
    }

    setSending(false);
  };

  const handleSendSms = async () => {
    const content = selectedTemplateContent;
    if (!content) {
      toast.error('Selected template has no content');
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { testMode: true, testNumber: phone.trim(), content },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Test SMS sent successfully');
        addResult({
          channel: 'SMS (Laaffic)',
          number: phone,
          status: 'success',
          message: data.message || 'Sent',
          templateName: selectedTemplateName,
          timestamp: new Date().toISOString(),
          raw: data,
        });
      } else {
        toast.error(data?.error || 'SMS send failed');
        addResult({
          channel: 'SMS (Laaffic)',
          number: phone,
          status: 'error',
          message: data?.error || 'Unknown error',
          templateName: selectedTemplateName,
          timestamp: new Date().toISOString(),
          raw: data,
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send test SMS');
      addResult({
        channel: 'SMS (Laaffic)',
        number: phone,
        status: 'error',
        message: err.message || 'Request failed',
        templateName: selectedTemplateName,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleSendWhatsApp = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wati-proxy?action=send_template`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          whatsappNumber: phone.trim(),
          templateName: selectedWaTemplate,
        }),
      });
      const res = await resp.json();

      const invalidWa = res?.validWhatsAppNumber === false;
      const isSuccess = resp.ok && !res?.error && !invalidWa;
      if (isSuccess) {
        toast.success('Test WhatsApp template sent');
        addResult({
          channel: 'WhatsApp (WATI)',
          number: phone,
          status: 'success',
          message: 'Template sent & delivered',
          templateName: selectedWaTemplate,
          timestamp: new Date().toISOString(),
          raw: res,
        });
      } else {
        const errMsg = invalidWa
          ? 'Number is not a valid WhatsApp number — message was NOT delivered'
          : (res?.message || res?.error || 'WhatsApp send failed');
        toast.error(errMsg);
        addResult({
          channel: 'WhatsApp (WATI)',
          number: phone,
          status: 'error',
          message: errMsg,
          templateName: selectedWaTemplate,
          timestamp: new Date().toISOString(),
          raw: res,
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send test WhatsApp');
      addResult({
        channel: 'WhatsApp (WATI)',
        number: phone,
        status: 'error',
        message: err.message || 'Request failed',
        templateName: selectedWaTemplate,
        timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Communication Testing</h2>
        <p className="text-sm text-muted-foreground">
          This tab is for Admin testing of SMS and WhatsApp integrations. Only approved templates can be sent.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Send Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send Test Template</CardTitle>
            <CardDescription>Select a channel and approved template to test delivery</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="test-phone">Phone Number</Label>
              <Input
                id="test-phone"
                placeholder="e.g. 919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Enter full number with country code (e.g. 91...)</p>
            </div>

            {/* Channel */}
            <div className="space-y-2">
              <Label>Channel</Label>
              <div className="flex gap-2">
                <Button
                  variant={channel === 'sms' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChannel('sms')}
                  className="flex-1 text-xs"
                >
                  <Phone className="h-3.5 w-3.5 mr-1.5" />
                  SMS (Laaffic)
                </Button>
                <Button
                  variant={channel === 'whatsapp' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChannel('whatsapp')}
                  className="flex-1 text-xs"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  WhatsApp (WATI)
                </Button>
              </div>
            </div>

            {/* Template dropdown */}
            <div className="space-y-2">
              <Label>Template</Label>
              {channel === 'sms' ? (
                <Select value={selectedSmsTemplate} onValueChange={setSelectedSmsTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select SMS template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {smsTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                    {smsTemplates.length === 0 && (
                      <SelectItem value="_none" disabled>No approved SMS templates</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedWaTemplate} onValueChange={setSelectedWaTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select WhatsApp template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {waTemplates.map((t) => (
                      <SelectItem key={t.elementName} value={t.elementName}>
                        <span>{t.elementName}</span>
                        {t.category && (
                          <span className="ml-2 text-muted-foreground text-[10px]">({t.category})</span>
                        )}
                      </SelectItem>
                    ))}
                    {waTemplates.length === 0 && (
                      <SelectItem value="_none" disabled>No approved WhatsApp templates</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Template preview */}
            {channel === 'sms' && selectedTemplateContent && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Template Preview
                </Label>
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-foreground whitespace-pre-wrap">
                  {selectedTemplateContent}
                </div>
              </div>
            )}

            {channel === 'whatsapp' && selectedWaTemplate && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Selected Template
                </Label>
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-foreground">
                  {selectedWaTemplate}
                </div>
              </div>
            )}

            {/* Send */}
            <Button
              onClick={handleSend}
              disabled={sending || !phone.trim() || !isTemplateSelected}
              className="w-full"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sending ? 'Sending...' : `Send Test ${channel === 'sms' ? 'SMS' : 'WhatsApp'}`}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test Results</CardTitle>
            <CardDescription>Recent test send results</CardDescription>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No tests sent yet. Select a template and send to see results here.
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {results.map((r, idx) => (
                  <div key={idx} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {r.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <Badge variant={r.status === 'success' ? 'default' : 'destructive'} className="text-[10px]">
                          {r.channel}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">To: {r.number}</p>
                    {r.templateName && (
                      <p className="text-xs font-medium">Template: {r.templateName}</p>
                    )}
                    <p className="text-xs">{r.message}</p>
                    {r.raw && (
                      <details className="text-[10px] text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">Raw response</summary>
                        <pre className="mt-1 rounded bg-muted p-2 overflow-x-auto text-[10px]">
                          {JSON.stringify(r.raw, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
