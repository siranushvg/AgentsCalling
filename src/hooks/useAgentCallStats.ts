import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AgentCallStats {
  totalAssigned: number;
  totalContacted: number;
  totalInQueue: number;
  dialsToday: number;
  contactsToday: number;
  convertedToday: number;
  totalDialsAllTime: number;
}

export function useAgentCallStats() {
  const [stats, setStats] = useState<AgentCallStats>({
    totalAssigned: 0, totalContacted: 0, totalInQueue: 0,
    dialsToday: 0, contactsToday: 0, convertedToday: 0, totalDialsAllTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agentId } = await supabase.rpc('get_agent_id_for_user', { _user_id: user.id });
    if (!agentId) return;

    // Use IST (UTC+5:30) for "today" to match business operations
    const nowUTC = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(nowUTC.getTime() + istOffsetMs);
    const istDateStr = nowIST.toISOString().slice(0, 10); // YYYY-MM-DD in IST
    // Midnight IST in UTC
    const todayIST_UTC = new Date(istDateStr + 'T00:00:00+05:30');
    const todayISO = todayIST_UTC.toISOString();

    // Use count-only queries to avoid the 1000 row limit
    const [
      queueCount, contactedCount, convertedCount, allAssignedCount,
      dialedTodayCount, callsTodayRes, callsAllRes
    ] = await Promise.all([
      // In-queue leads (new, assigned, callback)
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', agentId)
        .in('status', ['new', 'assigned', 'callback']),
      // Contacted leads
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', agentId)
        .eq('status', 'contacted'),
      // Converted leads
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', agentId)
        .eq('status', 'converted'),
      // All assigned leads (any status)
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', agentId),
      // Leads moved out of queue today (reports-based daily dial count)
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', agentId)
        .in('status', ['contacted', 'converted'])
        .gte('updated_at', todayISO),
      // Today's call rows for contact/conversion metrics
      (async () => {
        const PAGE_SIZE = 1000;
        let all: any[] = [];
        let pg = 0;
        while (true) {
          const r = await supabase
            .from('calls')
            .select('id, status, disposition')
            .eq('agent_id', agentId)
            .gte('started_at', todayISO)
            .range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1);
          if (r.error) return { data: all, error: r.error };
          all = all.concat(r.data ?? []);
          if (!r.data || r.data.length < PAGE_SIZE) break;
          pg++;
        }
        return { data: all, error: null };
      })(),
      // All-time calls count
      supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agentId),
    ]);

    const todayCalls = callsTodayRes.data ?? [];
    const dialsToday = dialedTodayCount.count ?? 0;
    const contactsToday = todayCalls.filter(c => c.status === 'connected' || c.status === 'completed').length;
    const convertedToday = todayCalls.filter(c => c.disposition === 'converted').length;

    setStats({
      totalAssigned: allAssignedCount.count ?? 0,
      totalContacted: (contactedCount.count ?? 0) + (convertedCount.count ?? 0),
      totalInQueue: queueCount.count ?? 0,
      dialsToday,
      contactsToday,
      convertedToday,
      totalDialsAllTime: callsAllRes.count ?? 0,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();

    const ch1 = supabase.channel('agent-stats-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchStats)
      .subscribe();
    const ch2 = supabase.channel('agent-stats-calls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, fetchStats)
      .subscribe();

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [fetchStats]);

  return { stats, isLoading, refetch: fetchStats };
}
