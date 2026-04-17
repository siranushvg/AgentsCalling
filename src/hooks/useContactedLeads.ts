import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContactedLead {
  id: string;
  username: string;
  phone_number: string;
  language: string;
  state: string;
  status: string;
  updated_at: string;
  potential_commission: number;
  temperature: string;
  last_disposition?: string | null;
  last_recording_url?: string | null;
  last_call_mode?: string | null;
}

export function useContactedLeads() {
  const [leads, setLeads] = useState<ContactedLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    const { data: agentData } = await supabase.rpc('get_agent_id_for_user', {
      _user_id: (await supabase.auth.getUser()).data.user?.id ?? '',
    });

    if (!agentData) {
      setLeads([]);
      setIsLoading(false);
      return;
    }

    // Paginated fetch to bypass 1000-row limit
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let error: any = null;

    while (true) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase
        .from('leads')
        .select('id, username, phone_number, language, state, status, updated_at, potential_commission, temperature')
        .eq('assigned_agent_id', agentData)
        .in('status', ['contacted', 'callback', 'converted', 'not_interested'])
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (res.error) { error = res.error; break; }
      allData = allData.concat(res.data ?? []);
      if (!res.data || res.data.length < PAGE_SIZE) break;
      page++;
    }

    // Fetch latest disposition for each contacted lead from calls table
    const leadIds = allData.map((l: any) => l.id);
    const dispositionMap: Record<string, string> = {};
    const recordingMap: Record<string, string> = {};
    const callModeMap: Record<string, string> = {};

    if (leadIds.length > 0) {
      // Fetch in batches of 200 to stay within query limits
      for (let i = 0; i < leadIds.length; i += 200) {
        const batch = leadIds.slice(i, i + 200);
        const { data: callsData } = await supabase
          .from('calls')
          .select('lead_id, disposition, recording_url, started_at, call_mode')
          .in('lead_id', batch)
          .eq('agent_id', agentData)
          .order('started_at', { ascending: false });

        if (callsData) {
          for (const call of callsData) {
            // Keep only the latest disposition per lead
            if (call.disposition && !dispositionMap[call.lead_id]) {
              dispositionMap[call.lead_id] = call.disposition;
            }
            // Keep the latest recording per lead
            if (call.recording_url && !recordingMap[call.lead_id]) {
              recordingMap[call.lead_id] = call.recording_url;
            }
            // Keep the latest call mode per lead
            if (!callModeMap[call.lead_id]) {
              callModeMap[call.lead_id] = call.call_mode || 'manual';
            }
          }
        }
      }
    }

    const data = allData.map((lead: any) => ({
      ...lead,
      last_disposition: dispositionMap[lead.id] || null,
      last_recording_url: recordingMap[lead.id] || null,
      last_call_mode: callModeMap[lead.id] || null,
    }));

    if (error) {
      console.error('Failed to fetch contacted leads:', error);
      setLeads([]);
    } else {
      setLeads(data ?? []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();

    const channel = supabase
      .channel('contacted-leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads]);

  const addBackToQueue = useCallback(async (leadId: string) => {
    // Check if lead is already in active queue statuses
    const { data: existing } = await supabase
      .from('leads')
      .select('id, status')
      .eq('id', leadId)
      .single();

    if (!existing) {
      toast.error('Lead not found');
      return false;
    }

    if (['new', 'assigned', 'callback'].includes(existing.status)) {
      toast.info('Lead is already in the active queue');
      return false;
    }

    const { error } = await supabase
      .from('leads')
      .update({ status: 'callback', updated_at: new Date().toISOString() })
      .eq('id', leadId);

    if (error) {
      console.error('Failed to add lead back to queue:', error);
      toast.error('Failed to add lead back to queue');
      return false;
    }

    toast.success('Lead added back to queue');
    return true;
  }, []);

  return { leads, isLoading, refetch: fetchLeads, addBackToQueue };
}
