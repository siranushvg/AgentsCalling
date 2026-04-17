import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { List, SkipForward, Phone, Users, Clock, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SharedCallWidget } from '@/components/calling/SharedCallWidget';
import { OutcomeLogger, type CallOutcome } from '@/components/calling/OutcomeLogger';
import { UserProfilePreview } from '@/components/calling/UserProfilePreview';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const QUEUE_MODE_STORAGE_KEY = 'agent-queue-mode-state';

interface StoredQueueModeState {
  queueId: string | null;
  leadId: string | null;
}

const readStoredQueueModeState = (): StoredQueueModeState => {
  if (typeof window === 'undefined') {
    return { queueId: null, leadId: null };
  }

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(QUEUE_MODE_STORAGE_KEY) ?? '{}') as Partial<StoredQueueModeState>;
    return {
      queueId: typeof parsed.queueId === 'string' ? parsed.queueId : null,
      leadId: typeof parsed.leadId === 'string' ? parsed.leadId : null,
    };
  } catch {
    return { queueId: null, leadId: null };
  }
};

interface QueueMember {
  id: string;
  lead_id: string;
  priority_score: number;
  status: string;
  attempt_count: number;
  last_outcome: string | null;
  queue_id: string;
  lead: {
    id: string;
    username: string;
    phone_number: string;
    state: string;
    language: string;
    temperature: string;
    score: number;
    potential_commission: number;
    total_call_attempts: number;
    last_called_at: string | null;
    status: string;
  };
}

interface Queue {
  id: string;
  name: string;
  type: string;
  status: string;
}

export default function QueueCallingMode() {
  const { user } = useAuth();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string>(() => readStoredQueueModeState().queueId ?? '');
  const [queueMembers, setQueueMembers] = useState<QueueMember[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showOutcome, setShowOutcome] = useState(false);
  const [lastCallDuration, setLastCallDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [agentPhone, setAgentPhone] = useState('');
  const [restoredLeadId, setRestoredLeadId] = useState<string | null>(() => readStoredQueueModeState().leadId);

  const currentMember = queueMembers[currentIndex];

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.sessionStorage.setItem(
      QUEUE_MODE_STORAGE_KEY,
      JSON.stringify({
        queueId: selectedQueueId || null,
        leadId: currentMember?.lead_id ?? restoredLeadId ?? null,
      }),
    );
  }, [currentMember?.lead_id, restoredLeadId, selectedQueueId]);

  // Fetch agent phone
  useEffect(() => {
    const fetchAgentPhone = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('agents').select('phone').eq('user_id', user.id).single();
      if (data?.phone) setAgentPhone(data.phone);
    };
    fetchAgentPhone();
  }, [user?.id]);

  // Load queues
  useEffect(() => {
    const loadQueues = async () => {
      const { data } = await supabase
        .from('call_queues')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      setQueues((data as Queue[]) || []);
      if (!selectedQueueId && data?.length) {
        setSelectedQueueId(data[0].id);
      }
      setLoading(false);
    };
    loadQueues();
  }, [selectedQueueId]);

  // Load queue members
  useEffect(() => {
    if (!selectedQueueId) return;

    const loadMembers = async () => {
      const { data } = await supabase
        .from('call_queue_members')
        .select('*, lead:leads(*)')
        .eq('queue_id', selectedQueueId)
        .in('status', ['pending', 'retry'])
        .order('priority_score', { ascending: false })
        .limit(50);

      const nextMembers = (data as unknown as QueueMember[]) || [];
      const restoredIndex = restoredLeadId
        ? nextMembers.findIndex((member) => member.lead_id === restoredLeadId)
        : -1;

      setQueueMembers(nextMembers);
      setCurrentIndex(restoredIndex >= 0 ? restoredIndex : 0);
    };
    loadMembers();
  }, [restoredLeadId, selectedQueueId]);

  const handleQueueChange = (queueId: string) => {
    setShowOutcome(false);
    setRestoredLeadId(null);
    setCurrentIndex(0);
    setSelectedQueueId(queueId);
  };

  const handleCallEnd = (duration: number) => {
    setLastCallDuration(duration);
    setShowOutcome(true);
  };

  const handleOutcomeSubmit = async (outcome: CallOutcome, notes: string) => {
    if (!currentMember) return;
    try {
      const { data: agentData } = await supabase.rpc('get_agent_id_for_user', { _user_id: user?.id || '' });
      const agentId = agentData as string;

      // Create call record
      await supabase.from('calls').insert({
        agent_id: agentId,
        lead_id: currentMember.lead_id,
        status: outcome === 'converted' ? 'completed' : outcome === 'no_answer' ? 'missed' : 'completed',
        duration_seconds: lastCallDuration,
        disposition: outcome as any,
        notes,
        call_mode: 'semi_auto',
        queue_id: selectedQueueId,
        attempt_number: (currentMember.attempt_count || 0) + 1,
      });

      // Update queue member status
      const newStatus = outcome === 'converted' || outcome === 'not_interested' || outcome === 'wrong_number'
        ? 'completed' : outcome === 'no_answer' || outcome === 'busy' ? 'retry' : 'completed';

      await supabase.from('call_queue_members').update({
        status: newStatus,
        attempt_count: (currentMember.attempt_count || 0) + 1,
        last_outcome: outcome,
        retry_after: newStatus === 'retry' ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
      }).eq('id', currentMember.id);

      // Update lead
      await supabase.from('leads').update({
        total_call_attempts: (currentMember.lead.total_call_attempts || 0) + 1,
        last_called_at: new Date().toISOString(),
      }).eq('id', currentMember.lead_id);

      toast.success('Outcome saved — moving to next');
      setShowOutcome(false);

      // Move to next
      if (currentIndex < queueMembers.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        toast.info('Queue completed!');
        setQueueMembers([]);
      }
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleSkip = async () => {
    if (!currentMember) return;
    await supabase.from('call_queue_members').update({
      status: 'skipped',
    }).eq('id', currentMember.id);
    
    if (currentIndex < queueMembers.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
    toast.info('Skipped');
  };

  const pendingCount = queueMembers.filter(m => m.status === 'pending' || m.status === 'retry').length;
  const completedCount = queueMembers.filter(m => m.status === 'completed').length;

  return (
    <div className="flex gap-4 h-full">
      {/* Left: Queue List */}
      <div className="w-72 shrink-0 space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <List className="h-4 w-4" /> Active Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedQueueId} onValueChange={handleQueueChange}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select queue..." />
              </SelectTrigger>
              <SelectContent>
                {queues.map(q => (
                  <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-md bg-muted p-2">
                <p className="text-lg font-bold">{pendingCount}</p>
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
              <div className="rounded-md bg-muted p-2">
                <p className="text-lg font-bold">{completedCount}</p>
                <p className="text-[10px] text-muted-foreground">Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Queue member list */}
        <div className="space-y-1 max-h-[calc(100vh-22rem)] overflow-y-auto">
          {queueMembers.length === 0 && !loading && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No users in queue</p>
              <p className="text-xs mt-1">Queue members will appear once a campaign or admin assigns them.</p>
            </div>
          )}
          {queueMembers.map((member, idx) => (
            <button
              key={member.id}
              onClick={() => {
                setCurrentIndex(idx);
                setRestoredLeadId(member.lead_id);
                setShowOutcome(false);
              }}
              className={cn(
                'w-full text-left rounded-lg border p-3 transition-all',
                idx === currentIndex ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent',
                member.status === 'completed' && 'opacity-50'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{member.lead?.username || 'Unknown'}</span>
                {idx === currentIndex && <ChevronRight className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground">
                Priority: {member.priority_score} · Attempts: {member.attempt_count}
              </p>
              {member.last_outcome && (
                <Badge variant="outline" className="text-[10px] mt-1">{member.last_outcome}</Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Center: Call Area */}
      <div className="flex-1 rounded-lg border bg-card shadow-sm flex flex-col min-w-0">
        {showOutcome && currentMember ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-md">
              <OutcomeLogger
                leadName={currentMember.lead?.username || ''}
                callDuration={lastCallDuration}
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
                  {currentMember.lead.state} · {currentMember.lead.language} · Score: {currentMember.lead.score}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleSkip}>
                  <SkipForward className="h-4 w-4 mr-1" /> Skip
                </Button>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Position</p>
                  <p className="text-lg font-bold">{currentIndex + 1}/{queueMembers.length}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8">
              <SharedCallWidget
                leadName={currentMember.lead.username}
                leadPhone={currentMember.lead.phone_number}
                leadLanguage={currentMember.lead.language}
                leadState={currentMember.lead.state}
                leadScore={currentMember.lead.score}
                potentialCommission={currentMember.lead.potential_commission}
                agentPhone={agentPhone}
                leadId={currentMember.lead_id}
                callMode="semi_auto"
                onCallStart={() => {}}
                onCallEnd={handleCallEnd}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 p-8">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <List className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Queue Calling Mode</p>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Select a queue to start working through prioritized leads. The system will auto-advance you to the next user after each call.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Profile */}
      {currentMember?.lead && !showOutcome && (
        <div className="w-56 shrink-0 rounded-lg border bg-card shadow-sm p-4 overflow-y-auto">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Users className="h-4 w-4" /> Profile
          </div>
          <UserProfilePreview
            lead={currentMember.lead}
            compact
            showWarnings={false}
          />
        </div>
      )}
    </div>
  );
}
