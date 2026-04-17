import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Users, Clock, Phone, ChevronRight, SkipForward } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SharedCallWidget } from '@/components/calling/SharedCallWidget';
import { OutcomeLogger, type CallOutcome } from '@/components/calling/OutcomeLogger';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  max_attempts: number;
  script_template: string | null;
  total_users: number;
  completed_count: number;
  converted_count: number;
}

interface CampaignMember {
  id: string;
  lead_id: string;
  priority_score: number;
  status: string;
  attempt_count: number;
  last_outcome: string | null;
  lead: {
    id: string;
    username: string;
    state: string;
    language: string;
    score: number;
    potential_commission: number;
    temperature: string;
    total_call_attempts: number;
  };
}

export default function CampaignCallingMode() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showOutcome, setShowOutcome] = useState(false);
  const [lastDuration, setLastDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [agentPhone, setAgentPhone] = useState('');

  const currentMember = members[currentIdx];

  // Fetch agent phone
  useEffect(() => {
    const fetchAgentPhone = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('agents').select('phone').eq('user_id', user.id).single();
      if (data?.phone) setAgentPhone(data.phone);
    };
    fetchAgentPhone();
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      const { data: agentData } = await supabase.rpc('get_agent_id_for_user', { _user_id: user?.id || '' });
      if (!agentData) { setLoading(false); return; }

      const { data: assignments } = await supabase
        .from('campaign_agents')
        .select('campaign_id')
        .eq('agent_id', agentData as string)
        .eq('status', 'active');

      if (!assignments?.length) { setLoading(false); return; }

      const campaignIds = assignments.map(a => a.campaign_id);
      const { data: camps } = await supabase
        .from('call_campaigns')
        .select('*')
        .in('id', campaignIds)
        .eq('status', 'active');

      setCampaigns((camps as Campaign[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const selectCampaign = async (camp: Campaign) => {
    setSelectedCampaign(camp);
    const { data: agentData } = await supabase.rpc('get_agent_id_for_user', { _user_id: user?.id || '' });
    
    const { data } = await supabase
      .from('call_queue_members')
      .select('*, lead:leads(*)')
      .eq('campaign_id', camp.id)
      .eq('assigned_agent_id', agentData as string)
      .in('status', ['pending', 'retry'])
      .order('priority_score', { ascending: false })
      .limit(50);

    setMembers((data as unknown as CampaignMember[]) || []);
    setCurrentIdx(0);
  };

  const handleCallEnd = (d: number) => { setLastDuration(d); setShowOutcome(true); };

  const handleOutcomeSubmit = async (outcome: CallOutcome, notes: string) => {
    if (!currentMember || !selectedCampaign) return;
    try {
      const { data: agentData } = await supabase.rpc('get_agent_id_for_user', { _user_id: user?.id || '' });

      await supabase.from('calls').insert({
        agent_id: agentData as string,
        lead_id: currentMember.lead_id,
        status: outcome === 'converted' ? 'completed' : 'completed',
        duration_seconds: lastDuration,
        disposition: outcome as any,
        notes,
        call_mode: 'auto',
        campaign_id: selectedCampaign.id,
        attempt_number: (currentMember.attempt_count || 0) + 1,
      });

      const newStatus = outcome === 'converted' || outcome === 'not_interested' || outcome === 'wrong_number'
        ? 'completed' : outcome === 'no_answer' || outcome === 'busy' ? 'retry' : 'completed';

      await supabase.from('call_queue_members').update({
        status: newStatus,
        attempt_count: (currentMember.attempt_count || 0) + 1,
        last_outcome: outcome,
        retry_after: newStatus === 'retry' ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
      }).eq('id', currentMember.id);

      toast.success('Saved — next user');
      setShowOutcome(false);
      if (currentIdx < members.length - 1) setCurrentIdx(prev => prev + 1);
      else { toast.info('Campaign batch completed!'); setMembers([]); }
    } catch { toast.error('Failed to save'); }
  };

  const handleSkip = async () => {
    if (!currentMember) return;
    await supabase.from('call_queue_members').update({ status: 'skipped' }).eq('id', currentMember.id);
    if (currentIdx < members.length - 1) setCurrentIdx(prev => prev + 1);
  };

  if (!selectedCampaign) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Your Campaign Assignments</h2>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-muted-foreground">No Active Campaigns</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Campaign assignments will appear here when an admin assigns you to an active campaign.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map(camp => (
              <Card key={camp.id} className="cursor-pointer hover:ring-1 hover:ring-primary transition-all" onClick={() => selectCampaign(camp)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    {camp.name}
                    <Badge variant="outline" className="text-[10px]">{camp.status}</Badge>
                  </CardTitle>
                  {camp.description && <p className="text-xs text-muted-foreground">{camp.description}</p>}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-muted p-2">
                      <p className="text-lg font-bold">{camp.total_users}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                    <div className="rounded bg-muted p-2">
                      <p className="text-lg font-bold">{camp.completed_count}</p>
                      <p className="text-[10px] text-muted-foreground">Done</p>
                    </div>
                    <div className="rounded bg-muted p-2">
                      <p className="text-lg font-bold text-earning">{camp.converted_count}</p>
                      <p className="text-[10px] text-muted-foreground">Converted</p>
                    </div>
                  </div>
                  <Button className="w-full mt-3" size="sm">
                    <Phone className="h-4 w-4 mr-1" /> Start Calling
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Left sidebar */}
      <div className="w-72 shrink-0 space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{selectedCampaign.name}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)} className="text-xs">
                ← Back
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded bg-muted p-2">
                <p className="text-lg font-bold">{members.length}</p>
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
              <div className="rounded bg-muted p-2">
                <p className="text-lg font-bold">{currentIdx}</p>
                <p className="text-[10px] text-muted-foreground">Called</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-1 max-h-[calc(100vh-22rem)] overflow-y-auto">
          {members.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => { setCurrentIdx(idx); setShowOutcome(false); }}
              className={cn(
                'w-full text-left rounded-lg border p-3 transition-all',
                idx === currentIdx ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{m.lead?.username}</span>
                {idx === currentIdx && <ChevronRight className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground">P: {m.priority_score} · A: {m.attempt_count}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Center */}
      <div className="flex-1 rounded-lg border bg-card shadow-sm flex flex-col min-w-0">
        {showOutcome && currentMember ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-md">
              <OutcomeLogger
                leadName={currentMember.lead?.username || ''}
                callDuration={lastDuration}
                onSubmit={handleOutcomeSubmit}
                required
              />
            </div>
          </div>
        ) : currentMember?.lead ? (
          <div className="flex-1 flex flex-col">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{currentMember.lead.username}</h3>
                <p className="text-sm text-muted-foreground">
                  {currentMember.lead.state} · {currentMember.lead.language}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleSkip}>
                  <SkipForward className="h-4 w-4 mr-1" /> Skip
                </Button>
                <span className="text-sm font-mono">{currentIdx + 1}/{members.length}</span>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-8">
              <SharedCallWidget
                leadName={currentMember.lead.username}
                leadPhone={(currentMember.lead as any).phone_number || ''}
                leadLanguage={currentMember.lead.language}
                leadState={currentMember.lead.state}
                leadScore={currentMember.lead.score}
                potentialCommission={currentMember.lead.potential_commission}
                agentPhone={agentPhone}
                leadId={currentMember.lead_id}
                callMode="auto"
                onCallStart={() => {}}
                onCallEnd={handleCallEnd}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Megaphone className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No more leads in this campaign batch</p>
          </div>
        )}
      </div>
    </div>
  );
}
