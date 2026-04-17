import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Lead } from '@/types';

export function useLeadQueue() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Stable serial number map: lead id -> sr no, assigned on first fetch, never reassigned
  const serialMapRef = useRef<Map<string, number>>(new Map());
  const nextSerialRef = useRef(1);
  const agentIdRef = useRef<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);

    // Resolve agent ID once and cache it
    if (!agentIdRef.current) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: aid } = await supabase.rpc('get_agent_id_for_user', { _user_id: user.id });
        agentIdRef.current = aid ?? null;
      }
    }

    if (!agentIdRef.current) {
      // Don't clear existing leads on transient auth failure — preserve stale data
      console.warn('Could not resolve agent ID for lead queue — keeping existing data');
      setIsLoading(false);
      return;
    }

    // Fetch ALL leads using pagination to bypass the 1000-row default limit
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let error: any = null;

    while (true) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase
        .from('leads')
        .select('*')
        .eq('assigned_agent_id', agentIdRef.current)
        .in('status', ['new', 'assigned', 'callback'])
        .order('signup_at', { ascending: false })
        .range(from, to);

      if (res.error) { error = res.error; break; }
      allData = allData.concat(res.data ?? []);
      if (!res.data || res.data.length < PAGE_SIZE) break;
      page++;
    }
    const data = allData;

    if (error) {
      console.error('Failed to fetch leads:', error);
      // Don't clear existing leads on fetch error — preserve stale data
    } else {
      // Deduplicate by normalized phone (last 10 digits) — keep first occurrence (newest by signup_at desc)
      const seenPhones = new Set<string>();
      const seenUsernames = new Set<string>();
      const deduped = (data ?? []).filter((row) => {
        const normPhone = row.phone_number?.replace(/\D/g, '').slice(-10) ?? '';
        const key = normPhone || row.username;
        if (seenPhones.has(normPhone) || seenUsernames.has(row.username)) return false;
        if (normPhone) seenPhones.add(normPhone);
        seenUsernames.add(row.username);
        return true;
      });

      const mapped = deduped.map((row) => {
        if (!serialMapRef.current.has(row.id)) {
          serialMapRef.current.set(row.id, nextSerialRef.current++);
        }
        return {
          id: row.id,
          username: row.username,
          state: row.state,
          language: row.language as Lead['language'],
          signup_minutes_ago: Math.max(0, Math.round((Date.now() - new Date(row.signup_at).getTime()) / 60000)),
          temperature: row.temperature as Lead['temperature'],
          potential_commission: Number(row.potential_commission),
          score: row.score,
          status: row.status as Lead['status'],
          assigned_agent_id: row.assigned_agent_id ?? undefined,
          source: row.source as Lead['source'],
          campaign_id: row.campaign_id ?? undefined,
          created_at: row.created_at,
          import_date: row.import_date ?? undefined,
          import_batch_id: row.import_batch_id ?? undefined,
          imported_by_admin: row.imported_by_admin ?? undefined,
          serial_number: serialMapRef.current.get(row.id)!,
        };
      });
      setLeads(mapped);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();

    // Debounced refetch: coalesce rapid realtime events into a single fetch
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        fetchLeads();
      }, 2000); // Wait 2s after last event before refetching
    };

    // Subscribe to realtime changes on the leads table
    const channel = supabase
      .channel('lead-queue-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        debouncedRefetch
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchLeads]);

  const resetSerialNumbers = useCallback(() => {
    serialMapRef.current.clear();
    nextSerialRef.current = 1;
    fetchLeads();
  }, [fetchLeads]);

  return { leads, isLoading, refetch: fetchLeads, resetSerialNumbers };
}
