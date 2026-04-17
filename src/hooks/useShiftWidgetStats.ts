import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ShiftWidgetStats {
  activeHoursToday: number;
  activeHoursThisMonth: number;
  callsThisWeek: number;
  loggedInSince: string | null;
  hoursTarget: number;
  weeklyCallsTarget: number;
}

const DEFAULTS: ShiftWidgetStats = {
  activeHoursToday: 0,
  activeHoursThisMonth: 0,
  callsThisWeek: 0,
  loggedInSince: null,
  hoursTarget: 208,
  weeklyCallsTarget: 1050,
};

export function useShiftWidgetStats() {
  const [stats, setStats] = useState<ShiftWidgetStats>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const sessionEnsuredRef = useRef(false);

  const fetchStats = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agentId } = await supabase.rpc('get_agent_id_for_user', { _user_id: user.id });
    if (!agentId) return;

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Ensure a session record exists for today (run once per mount)
    if (!sessionEnsuredRef.current) {
      sessionEnsuredRef.current = true;
      const { data: existingSession } = await supabase
        .from('agent_sessions')
        .select('id')
        .eq('agent_id', agentId)
        .eq('shift_date', todayStr)
        .limit(1);

      if (!existingSession || existingSession.length === 0) {
        await supabase.from('agent_sessions').insert({
          agent_id: agentId,
          shift_date: todayStr,
          login_at: now.toISOString(),
          active_minutes: 0,
          idle_minutes: 0,
        });
      }
    }

    // Week start (Monday)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    // Month start
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const [sessionsToday, sessionsMonth, callsWeek, salarySettings] = await Promise.all([
      supabase
        .from('agent_sessions')
        .select('active_minutes, login_at')
        .eq('agent_id', agentId)
        .eq('shift_date', todayStr),
      supabase
        .from('agent_sessions')
        .select('active_minutes, login_at, logout_at, shift_date')
        .eq('agent_id', agentId)
        .gte('shift_date', monthStart.toISOString().slice(0, 10)),
      supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .gte('started_at', weekStart.toISOString()),
      supabase
        .from('salary_settings')
        .select('min_hours_required, min_calls_required')
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const todaySessions = sessionsToday.data ?? [];
    
    // Compute active hours today: use stored active_minutes + elapsed time since login (for ongoing session)
    let activeMinutesToday = 0;
    let loggedInSince: string | null = null;

    if (todaySessions.length > 0) {
      // Find earliest login
      const sorted = [...todaySessions].sort(
        (a, b) => new Date(a.login_at).getTime() - new Date(b.login_at).getTime()
      );
      const earliestLogin = new Date(sorted[0].login_at);
      loggedInSince = earliestLogin.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      // Sum stored active_minutes
      const storedMinutes = todaySessions.reduce((sum, s) => sum + (s.active_minutes || 0), 0);

      // For the current (ongoing) session, add elapsed time since login
      // The latest session without logout_at is the current one
      const elapsedSinceLogin = Math.max(0, (now.getTime() - earliestLogin.getTime()) / 60000);
      
      // Use the greater of stored minutes or elapsed time (since stored may not update in real-time)
      activeMinutesToday = Math.max(storedMinutes, elapsedSinceLogin);
    }

    // Monthly: sum stored + today's live computation
    const monthSessions = sessionsMonth.data ?? [];
    let activeMinutesMonth = 0;
    for (const s of monthSessions) {
      if (s.shift_date === todayStr) {
        // Already counted above via live computation
        continue;
      }
      if (s.active_minutes > 0) {
        activeMinutesMonth += s.active_minutes;
      } else if (s.login_at) {
        // Fallback: compute from login/logout times
        const login = new Date(s.login_at);
        const logout = s.logout_at ? new Date(s.logout_at) : login;
        activeMinutesMonth += Math.max(0, (logout.getTime() - login.getTime()) / 60000);
      }
    }
    activeMinutesMonth += activeMinutesToday;

    setStats({
      activeHoursToday: Math.round((activeMinutesToday / 60) * 10) / 10,
      activeHoursThisMonth: Math.round((activeMinutesMonth / 60) * 10) / 10,
      callsThisWeek: callsWeek.count ?? 0,
      loggedInSince,
      hoursTarget: salarySettings.data?.min_hours_required ? Number(salarySettings.data.min_hours_required) : 208,
      weeklyCallsTarget: salarySettings.data?.min_calls_required ?? 1050,
    });
    setIsLoading(false);
  }, []);

  // Persist active_minutes to the database so admin dashboards reflect real data
  const persistActiveMinutes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agentId } = await supabase.rpc('get_agent_id_for_user', { _user_id: user.id });
    if (!agentId) return;

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Get today's earliest session login
    const { data: sessions } = await supabase
      .from('agent_sessions')
      .select('id, login_at')
      .eq('agent_id', agentId)
      .eq('shift_date', todayStr)
      .order('login_at', { ascending: true })
      .limit(1);

    if (!sessions || sessions.length === 0) return;

    const earliestLogin = new Date(sessions[0].login_at);
    const elapsedMinutes = Math.max(0, Math.round((now.getTime() - earliestLogin.getTime()) / 60000));

    // Update the earliest session record with the computed active minutes
    await supabase
      .from('agent_sessions')
      .update({ active_minutes: elapsedMinutes })
      .eq('id', sessions[0].id);
  }, []);

  useEffect(() => {
    fetchStats();

    // Debounce realtime events to prevent storm of refetches
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        fetchStats();
      }, 3000);
    };

    const ch1 = supabase.channel('shift-widget-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_sessions' }, debouncedFetch)
      .subscribe();
    const ch2 = supabase.channel('shift-widget-calls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, debouncedFetch)
      .subscribe();

    // Refresh stats every 2 minutes and persist active_minutes to DB
    const interval = setInterval(() => {
      fetchStats();
      persistActiveMinutes();
    }, 2 * 60 * 1000);

    // Persist on mount too
    persistActiveMinutes();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      clearInterval(interval);
    };
  }, [fetchStats, persistActiveMinutes]);

  return { stats, isLoading };
}
