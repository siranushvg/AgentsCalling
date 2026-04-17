import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InboundCallRecord {
  id: string;
  lead_id: string;
  lead_username: string;
  lead_phone: string;
  lead_language: string;
  lead_state: string;
  agent_name: string;
  status: string;
  disposition: string | null;
  duration_seconds: number;
  recording_url: string | null;
  started_at: string;
  ended_at: string | null;
  call_mode: string;
  notes: string | null;
}

export function useInboundCallLog() {
  const [calls, setCalls] = useState<InboundCallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCalls = useCallback(async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCalls([]); setIsLoading(false); return; }

    const { data: agentId } = await supabase.rpc('get_agent_id_for_user', { _user_id: user.id });
    if (!agentId) { setCalls([]); setIsLoading(false); return; }

    // Fetch inbound calls for this agent
    const { data: callsData, error } = await supabase
      .from('calls')
      .select('id, lead_id, status, disposition, duration_seconds, recording_url, started_at, ended_at, call_mode, notes, agent_id, caller_number')
      .eq('agent_id', agentId)
      .eq('call_mode', 'inbound')
      .order('started_at', { ascending: false })
      .limit(200);

    if (error || !callsData) {
      console.error('Failed to fetch inbound calls:', error);
      setCalls([]);
      setIsLoading(false);
      return;
    }

    // Get lead details for all calls
    const leadIds = [...new Set(callsData.map(c => c.lead_id).filter(Boolean))];
    const leadsMap: Record<string, { username: string; phone_number: string; language: string; state: string }> = {};

    if (leadIds.length > 0) {
      for (let i = 0; i < leadIds.length; i += 200) {
        const batch = leadIds.slice(i, i + 200);
        const { data: leads } = await supabase
          .from('leads')
          .select('id, username, phone_number, language, state')
          .in('id', batch);
        if (leads) {
          for (const l of leads) {
            leadsMap[l.id] = l;
          }
        }
      }
    }

    // Get agent name
    const { data: agentData } = await supabase
      .from('agents')
      .select('full_name')
      .eq('id', agentId)
      .single();

    const agentName = agentData?.full_name || 'Unknown';

    const records: InboundCallRecord[] = callsData.map(c => {
      const lead = c.lead_id ? leadsMap[c.lead_id] : null;
      return {
        id: c.id,
        lead_id: c.lead_id || '',
        lead_username: lead?.username || (c.caller_number ? `Unknown (${(c.caller_number as string).slice(-4)})` : 'Unknown'),
        lead_phone: lead?.phone_number || (c.caller_number as string) || '',
        lead_language: lead?.language || '',
        lead_state: lead?.state || '',
        agent_name: agentName,
        status: c.status,
        disposition: c.disposition,
        duration_seconds: c.duration_seconds,
        recording_url: c.recording_url,
        started_at: c.started_at,
        ended_at: c.ended_at,
        call_mode: c.call_mode,
        notes: c.notes,
      };
    });

    setCalls(records);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCalls();

    const channel = supabase
      .channel('inbound-call-log')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, fetchCalls)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCalls]);

  return { calls, isLoading, refetch: fetchCalls };
}
