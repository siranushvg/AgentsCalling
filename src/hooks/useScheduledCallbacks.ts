import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ScheduledCallback } from '@/components/workspace/PriorityQueue';

export function useScheduledCallbacks() {
  const { user } = useAuth();
  const [callbacks, setCallbacks] = useState<ScheduledCallback[]>([]);
  const [hotLeadItems, setHotLeadItems] = useState<ScheduledCallback[]>([]);
  const agentIdRef = useRef<string | null>(null);

  // Resolve agent ID once
  useEffect(() => {
    if (!user?.id) return;
    supabase.rpc('get_agent_id_for_user', { _user_id: user.id }).then(({ data }) => {
      agentIdRef.current = data as string | null;
      // Fetch hot leads once agent ID is known
      if (data) fetchHotLeads(data as string);
    });
  }, [user?.id]);

  const fetchHotLeads = useCallback(async (agentId: string) => {
    // "Hot" = registered within last 3 days (matches LeadQueue badge logic)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('leads')
      .select('id, username, language, created_at')
      .eq('assigned_agent_id', agentId)
      .gte('created_at', threeDaysAgo)
      .in('status', ['new', 'assigned', 'callback'])
      .eq('suppressed', false)
      .order('call_priority', { ascending: false })
      .limit(50);

    if (data) {
      setHotLeadItems(data.map((lead: any) => ({
        id: `hot-${lead.id}`,
        leadId: lead.id,
        leadName: lead.username,
        disposition: 'hot_lead',
        scheduledAt: new Date(lead.created_at),
        reason: `Hot lead — ${lead.language}`,
        status: 'pending' as const,
        isHotLead: true,
      })));
    }
  }, []);

  // Load scheduled callbacks from DB on mount — filter by agent_id explicitly
  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      // Wait for agent ID to be resolved
      const waitForAgent = async () => {
        if (agentIdRef.current) return agentIdRef.current;
        // Small delay to let the agent ID resolution effect run first
        await new Promise(r => setTimeout(r, 500));
        return agentIdRef.current;
      };
      const agentId = await waitForAgent();
      if (!agentId) return;

      const { data } = await supabase
        .from('scheduled_callbacks')
        .select('*')
        .eq('agent_id', agentId)
        .in('status', ['pending'])
        .order('scheduled_at', { ascending: true });

      if (data) {
        setCallbacks(data.map((row: any) => ({
          id: row.id,
          leadId: row.lead_id,
          leadName: row.lead_name,
          disposition: row.disposition,
          scheduledAt: new Date(row.scheduled_at),
          reason: row.reason || undefined,
          status: row.status as 'pending' | 'completed' | 'missed',
        })));
      }
    };
    load();
  }, [user?.id]);

  // Refresh hot leads when queue changes
  const refreshHotLeads = useCallback(() => {
    if (agentIdRef.current) fetchHotLeads(agentIdRef.current);
  }, [fetchHotLeads]);

  const addCallback = useCallback(async (cb: Omit<ScheduledCallback, 'id'>) => {
    if (!agentIdRef.current) return;
    const { data, error } = await supabase.from('scheduled_callbacks').insert({
      agent_id: agentIdRef.current,
      lead_id: cb.leadId,
      lead_name: cb.leadName,
      disposition: cb.disposition,
      scheduled_at: cb.scheduledAt.toISOString(),
      reason: cb.reason || null,
      status: cb.status,
    }).select('id').single();

    if (!error && data) {
      setCallbacks(prev => [...prev, { ...cb, id: data.id }]);
    }
  }, []);

  const completeCallback = useCallback(async (leadId: string) => {
    const cb = callbacks.find(c => c.leadId === leadId && c.status === 'pending');
    if (!cb) return null;

    await supabase.from('scheduled_callbacks').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', cb.id);
    setCallbacks(prev => prev.map(c => c.id === cb.id ? { ...c, status: 'completed' as const } : c));
    return cb;
  }, [callbacks]);

  const dismissItem = useCallback(async (itemId: string, leadId: string) => {
    // If it's a scheduled callback (not a hot lead), mark as completed in DB
    const isHot = itemId.startsWith('hot-');
    if (!isHot) {
      await supabase.from('scheduled_callbacks').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', itemId);
      setCallbacks(prev => prev.filter(c => c.id !== itemId));
    } else {
      // For hot leads, just remove from local state
      setHotLeadItems(prev => prev.filter(c => c.id !== itemId));
    }
  }, []);

  // Auto-remove items whose lead has been contacted (status changed)
  const removeByLeadId = useCallback(async (leadId: string) => {
    // Complete any scheduled callbacks for this lead
    const cb = callbacks.find(c => c.leadId === leadId && c.status === 'pending');
    if (cb) {
      await supabase.from('scheduled_callbacks').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', cb.id);
      setCallbacks(prev => prev.map(c => c.id === cb.id ? { ...c, status: 'completed' as const } : c));
    }
    // Remove hot lead entries
    setHotLeadItems(prev => prev.filter(c => c.leadId !== leadId));
  }, [callbacks]);

  // Combine scheduled callbacks + hot leads
  const allPriorityItems = [...callbacks, ...hotLeadItems];

  return { callbacks: allPriorityItems, addCallback, completeCallback, dismissItem, removeByLeadId, refreshHotLeads };
}
