import React, { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Phone, User, Clock, Star, X, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SharedCallWidget } from '@/components/calling/SharedCallWidget';
import { OutcomeLogger, type CallOutcome } from '@/components/calling/OutcomeLogger';
import { UserProfilePreview } from '@/components/calling/UserProfilePreview';
import { WhatsAppMessageModal } from '@/components/calling/WhatsAppMessageModal';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { maskPhone } from '@/lib/maskPhone';

interface FoundLead {
  id: string;
  username: string;
  phone_number: string;
  email: string | null;
  state: string;
  language: string;
  status: string;
  temperature: string;
  score: number;
  potential_commission: number;
  source: string;
  campaign_id: string | null;
  total_call_attempts: number;
  last_called_at: string | null;
  suppressed: boolean;
  call_priority: number;
  created_at: string;
}

interface CallHistoryItem {
  id: string;
  outcome: string;
  duration: number;
  agent_name?: string;
  created_at: string;
}

const QUICK_DIAL_CONTACTS = [
  { name: 'Test User 1', phone: '917016771063' },
  { name: 'Test User 2', phone: '918827371014' },
  { name: 'Test User 3', phone: '919234175177' },
  { name: 'Test User 4', phone: '918076603766' },
  { name: 'Test User 5', phone: '919832960845' },
  { name: 'Test User X', phone: '917405161791' },
  { name: 'Test User 10', phone: '919662387857' },
];

export default function ManualCallingMode() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoundLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<FoundLead | null>(null);
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [showOutcome, setShowOutcome] = useState(false);
  const [lastCallDuration, setLastCallDuration] = useState(0);
  const [agentPhone, setAgentPhone] = useState('');
  const [directDialNumber, setDirectDialNumber] = useState('');
  const [isDirectDial, setIsDirectDial] = useState(false);
  const [autoCallNumber, setAutoCallNumber] = useState<string | null>(null);
  const [waModalLeadId, setWaModalLeadId] = useState<string | null>(null);
  const [waModalLeadName, setWaModalLeadName] = useState('');

  // Fetch agent phone number — prefer Voicelay virtual number for click-to-call
  useEffect(() => {
    const fetchAgentPhone = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('agents')
        .select('phone, voicelay_virtual_number')
        .eq('user_id', user.id)
        .single();
      if (data) {
        // Use voicelay virtual number if available (registered with Voicelay), else fallback to agent phone
        setAgentPhone(data.voicelay_virtual_number || data.phone || '');
      }
    };
    fetchAgentPhone();
  }, [user?.id]);

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .or(`username.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,id.eq.${searchTerm.length === 36 ? searchTerm : '00000000-0000-0000-0000-000000000000'}`)
        .limit(20);

      if (error) throw error;
      setResults((data as FoundLead[]) || []);
      if (!data?.length) toast.info('No leads found');
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }, [searchTerm]);

  const selectLead = useCallback(async (lead: FoundLead) => {
    setSelectedLead(lead);
    setIsDirectDial(false);
    const { data } = await supabase
      .from('calls')
      .select('id, disposition, duration_seconds, started_at, agent_id')
      .eq('lead_id', lead.id)
      .order('started_at', { ascending: false })
      .limit(10);

    setCallHistory((data || []).map(c => ({
      id: c.id,
      outcome: c.disposition || 'N/A',
      duration: c.duration_seconds,
      created_at: c.started_at,
    })));
  }, []);

  const startDirectDial = (phone: string, name?: string) => {
    if (!agentPhone) {
      toast.error('Agent phone number not configured. Please contact admin.');
      return;
    }
    setDirectDialNumber(phone);
    setSelectedLead(null);
    setIsDirectDial(true);
    setAutoCallNumber(phone);
  };

  const handleCallEnd = async (duration: number) => {
    setLastCallDuration(duration);
    if (selectedLead) {
      // Auto-mark lead as contacted — no disposition required
      try {
        const { data: agentData } = await supabase.rpc('get_agent_id_for_user', { _user_id: user?.id || '' });
        const agentId = agentData as string;

        // Save call record
        if (agentId) {
          await supabase.from('calls').insert({
            agent_id: agentId,
            lead_id: selectedLead.id,
            status: 'completed' as any,
            duration_seconds: duration,
            call_mode: 'manual',
            attempt_number: (selectedLead.total_call_attempts || 0) + 1,
            ended_at: new Date().toISOString(),
          });
        }

        // Auto-move lead to 'contacted' so it leaves the queue
        await supabase.from('leads').update({
          total_call_attempts: (selectedLead.total_call_attempts || 0) + 1,
          last_called_at: new Date().toISOString(),
          status: 'contacted' as any,
        }).eq('id', selectedLead.id);
      } catch {
        // Silent
      }

      toast.success('Call ended — lead moved out of queue. You can optionally add a disposition.');
      // Keep lead selected so agent can optionally add disposition via the button
    } else {
      // Direct dial — save a call record for reporting
      toast.success(`Call ended — ${Math.floor(duration / 60)}m ${duration % 60}s`);
      try {
        const { data: agentData } = await supabase.rpc('get_agent_id_for_user', { _user_id: user?.id || '' });
        if (agentData) {
          const { data: leadMatch } = await supabase
            .from('leads')
            .select('id')
            .eq('phone_number', directDialNumber)
            .maybeSingle();

          if (leadMatch) {
            await supabase.from('calls').insert({
              agent_id: agentData as string,
              lead_id: leadMatch.id,
              status: 'completed' as any,
              duration_seconds: duration,
              call_mode: 'manual',
              attempt_number: 1,
              ended_at: new Date().toISOString(),
            });
          }
        }
      } catch {
        // Silent
      }
      setTimeout(() => {
        setIsDirectDial(false);
        setDirectDialNumber('');
      }, 1000);
    }
  };

  const handleOutcomeSubmit = async (outcome: CallOutcome, outNotes: string) => {
    if (!selectedLead) return;
    try {
      const { data: agentData } = await supabase.rpc('get_agent_id_for_user', { _user_id: user?.id || '' });
      const agentId = agentData as string;

      await supabase.from('calls').insert({
        agent_id: agentId,
        lead_id: selectedLead.id,
        status: outcome === 'converted' ? 'completed' : outcome === 'no_answer' ? 'missed' : 'completed',
        duration_seconds: lastCallDuration,
        disposition: outcome as any,
        notes: outNotes,
        call_mode: 'manual',
        attempt_number: (selectedLead.total_call_attempts || 0) + 1,
      });

      const newStatus = outcome === 'converted' ? 'converted'
        : outcome === 'not_interested' ? 'not_interested'
        : outcome === 'callback' ? 'callback'
        : 'contacted';

      await supabase.from('leads').update({
        total_call_attempts: (selectedLead.total_call_attempts || 0) + 1,
        last_called_at: new Date().toISOString(),
        status: newStatus as any,
      }).eq('id', selectedLead.id);

      toast.success('Call outcome saved');
      setShowOutcome(false);
      setSelectedLead(null);
      setResults([]);
      setSearchTerm('');
    } catch {
      toast.error('Failed to save outcome');
    }
  };

  const handleResetView = () => {
    setSelectedLead(null);
    setIsDirectDial(false);
    setDirectDialNumber('');
    setShowOutcome(false);
  };

  // Optional disposition view — agent can add disposition if they want
  if (showOutcome && selectedLead) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-full max-w-md">
          <OutcomeLogger
            leadName={selectedLead.username}
            callDuration={lastCallDuration}
            onSubmit={handleOutcomeSubmit}
          />
          <Button variant="ghost" className="w-full mt-2" onClick={() => { setShowOutcome(false); setSelectedLead(null); setResults([]); setSearchTerm(''); }}>
            Skip — No Disposition Needed
          </Button>
        </div>
      </div>
    );
  }

  if (selectedLead) {
    return (
      <div className="flex gap-4 h-full">
        <div className="flex-1 flex flex-col rounded-lg border bg-card shadow-sm">
          <div className="border-b px-6 py-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{selectedLead.username}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedLead.state} · {selectedLead.language} · Score: {selectedLead.score}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setWaModalLeadId(selectedLead.id); setWaModalLeadName(selectedLead.username); }}
                className="gap-1.5 border-success/40 text-success hover:bg-success/10"
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </Button>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Commission</p>
                <p className="text-lg font-bold text-earning">₹{selectedLead.potential_commission}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleResetView}>
                <X className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowOutcome(true)}>
                Add Disposition (Optional)
              </Button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-6">
            <SharedCallWidget
              leadName={selectedLead.username}
              leadPhone={selectedLead.phone_number}
              leadLanguage={selectedLead.language}
              leadState={selectedLead.state}
              leadScore={selectedLead.score}
              potentialCommission={selectedLead.potential_commission}
              agentPhone={agentPhone}
              leadId={selectedLead.id}
              callMode="manual"
              onCallStart={() => {}}
              onCallEnd={handleCallEnd}
            />
          </div>
        </div>
        <div className="w-64 shrink-0 rounded-lg border bg-card shadow-sm p-4 overflow-y-auto space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" /> User Profile
          </div>
          <UserProfilePreview lead={selectedLead} callHistory={callHistory} showWarnings compact />
        </div>
      </div>
    );
  }

  if (isDirectDial) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={handleResetView} className="mb-2">
              ← Back
            </Button>
            <p className="text-sm text-muted-foreground">Direct Dial</p>
          </div>
          <SharedCallWidget
            leadName="Direct Call"
            leadPhone={directDialNumber}
            agentPhone={agentPhone}
            callMode="manual"
            onCallStart={() => {}}
            onCallEnd={handleCallEnd}
            autoCall={autoCallNumber === directDialNumber}
            onAutoCallHandled={() => setAutoCallNumber(null)}
            compact
          />
        </div>
      </div>
    );
  }

  // === DEFAULT VIEW: Dialer + Quick Contacts + Search ===
  return (
    <div className="flex gap-4 h-full">
      {/* Center: Direct Dial */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-5">
          {/* Quick number input */}
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold">Quick Dial</h2>
            <p className="text-xs text-muted-foreground">Type a number and call instantly</p>
          </div>

          <div className="flex gap-2">
            <Input
              value={directDialNumber}
              onChange={e => setDirectDialNumber(e.target.value.replace(/[^0-9+]/g, ''))}
              placeholder="Enter phone number..."
              className="text-center text-lg font-mono h-12 tracking-wider"
              onKeyDown={e => {
                if (e.key === 'Enter' && directDialNumber.length >= 10) {
                  startDirectDial(directDialNumber);
                }
              }}
            />
            <Button
              size="lg"
              className="h-12 w-12 shrink-0 rounded-full bg-success hover:bg-success/90 text-success-foreground"
              onClick={() => startDirectDial(directDialNumber)}
              disabled={directDialNumber.length < 10}
            >
              <Phone className="h-5 w-5" />
            </Button>
          </div>

          {/* Quick Dial Contacts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-warning" /> Quick Contacts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {QUICK_DIAL_CONTACTS.map(c => (
                <button
                  key={c.phone}
                  onClick={() => startDirectDial(c.phone, c.name)}
                  className="w-full flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-accent transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {c.name.split(' ').pop()}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{maskPhone(c.phone)}</p>
                    </div>
                  </div>
                  <Phone className="h-4 w-4 text-muted-foreground group-hover:text-success transition-colors" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right: Lead Search */}
      <div className="w-80 shrink-0 space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4" /> Search Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Name, phone, email..."
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="text-sm"
              />
              <Button size="sm" onClick={handleSearch} disabled={searching}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-1 max-h-[calc(100vh-22rem)] overflow-y-auto">
          {results.map(lead => (
            <button
              key={lead.id}
              onClick={() => selectLead(lead)}
              className="w-full text-left rounded-lg border p-3 transition-all hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{lead.username}</span>
                <Badge variant="outline" className={`text-[10px] ${
                  lead.temperature === 'hot' ? 'border-hot text-hot' :
                  lead.temperature === 'warm' ? 'border-warm text-warm' : 'border-cool text-cool'
                }`}>
                  {lead.temperature}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {maskPhone(lead.phone_number)} · {lead.language}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-success hover:text-success"
                  onClick={(e) => {
                    e.stopPropagation();
                    startDirectDial(lead.phone_number, lead.username);
                  }}
                >
                  <Phone className="h-3 w-3 mr-1" /> Call Now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-success hover:text-success"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWaModalLeadId(lead.id);
                    setWaModalLeadName(lead.username);
                  }}
                >
                  <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                </Button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* WhatsApp Modal */}
      {waModalLeadId && (
        <WhatsAppMessageModal
          open={!!waModalLeadId}
          onClose={() => setWaModalLeadId(null)}
          leadId={waModalLeadId}
          leadName={waModalLeadName}
          maskedPhone={maskPhone(results.find(r => r.id === waModalLeadId)?.phone_number)}
        />
      )}
    </div>
  );
}
