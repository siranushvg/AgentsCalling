import React, { useState, useEffect, useCallback } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { Phone, Users, DollarSign, Target, Zap, Shield, Loader2, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { useAgentCallStats } from '@/hooks/useAgentCallStats';
import { supabase } from '@/integrations/supabase/client';

interface RecentCall {
  id: string;
  lead_username: string;
  status: string;
  duration_seconds: number;
  disposition: string | null;
  call_mode: string;
}

export default function AgentDashboard() {
  const { stats, isLoading: statsLoading } = useAgentCallStats();
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [commissionToday, setCommissionToday] = useState(0);
  const [commissionPeriod, setCommissionPeriod] = useState(0);
  const [directFtds, setDirectFtds] = useState(0);
  const [networkEarnings, setNetworkEarnings] = useState(0);
  const [commissionRate, setCommissionRate] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: agentId } = await supabase.rpc('get_agent_id_for_user', { _user_id: user.id });
    if (!agentId) return;

    // Use IST (UTC+5:30) for "today" to match business operations
    const nowUTC = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(nowUTC.getTime() + istOffsetMs);
    const istDateStr = nowIST.toISOString().slice(0, 10);
    const todayIST_UTC = new Date(istDateStr + 'T00:00:00+05:30');
    const todayISO = todayIST_UTC.toISOString();

    // Current month start in IST
    const monthStartStr = istDateStr.slice(0, 7) + '-01';
    const monthStart = new Date(monthStartStr + 'T00:00:00+05:30');

    const [callsRes, commTodayRes, commPeriodRes, rateRes] = await Promise.all([
      // Recent calls with lead name
      supabase
        .from('calls')
        .select('id, status, duration_seconds, disposition, call_mode, lead:leads(username)')
        .eq('agent_id', agentId)
        .order('started_at', { ascending: false })
        .limit(5),
      // Commissions today
      supabase
        .from('commissions')
        .select('amount, tier')
        .eq('agent_id', agentId)
        .gte('created_at', todayISO),
      // Commissions this month
      supabase
        .from('commissions')
        .select('amount, tier')
        .eq('agent_id', agentId)
        .gte('created_at', monthStart.toISOString()),
      // Commission rate
      supabase
        .from('commission_settings')
        .select('direct_rate')
        .order('effective_from', { ascending: false })
        .limit(1)
        .single(),
    ]);

    // Recent calls
    setRecentCalls(
      (callsRes.data ?? []).map((c: any) => ({
        id: c.id,
        lead_username: c.lead?.username || 'Unknown',
        status: c.status,
        duration_seconds: c.duration_seconds || 0,
        disposition: c.disposition,
        call_mode: c.call_mode || 'manual',
      }))
    );

    // Commissions
    const todayComms = commTodayRes.data ?? [];
    setCommissionToday(todayComms.reduce((s, c) => s + Number(c.amount), 0));

    const periodComms = commPeriodRes.data ?? [];
    setCommissionPeriod(periodComms.reduce((s, c) => s + Number(c.amount), 0));
    setDirectFtds(periodComms.filter(c => c.tier === 'direct').length);
    setNetworkEarnings(
      periodComms.filter(c => c.tier !== 'direct').reduce((s, c) => s + Number(c.amount), 0)
    );

    setCommissionRate(rateRes.data?.direct_rate ? Number(rateRes.data.direct_rate) : 0);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();

    const ch = supabase.channel('agent-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commissions' }, fetchDashboardData)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [fetchDashboardData]);

  const contactRate = stats.dialsToday > 0 ? ((stats.contactsToday / stats.dialsToday) * 100).toFixed(0) : '0';
  const loading = statsLoading || dataLoading;

  return (
    <div className="space-y-6">
      {/* Motivational Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-primary/5 p-4 flex items-start gap-3">
          <Zap className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium">Stay active during your shift</p>
            <p className="text-xs text-muted-foreground">Consistent activity ensures your basic salary eligibility and improves lead priority in your queue.</p>
          </div>
        </div>
        <div className="rounded-lg border bg-earning/5 p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-earning mt-0.5" />
          <div>
            <p className="text-sm font-medium">Grow your referral network</p>
            <p className="text-xs text-muted-foreground">Invite qualified agents using your referral code. Earn passive Tier 2 & Tier 3 income on their conversions.</p>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Dials Today"
          value={loading ? '…' : stats.dialsToday}
          icon={<Phone className="h-5 w-5" />}
          subtitle={`${stats.totalDialsAllTime} all-time dials`}
        />
        <KPICard
          title="Contacts Today"
          value={loading ? '…' : stats.contactsToday}
          icon={<Users className="h-5 w-5" />}
          subtitle={`${contactRate}% contact rate`}
        />
        <KPICard
          title="FTDs Today"
          value={loading ? '…' : stats.convertedToday}
          icon={<Target className="h-5 w-5" />}
          subtitle={`${directFtds} this month`}
        />
        <KPICard
          title="Commission Today"
          value={loading ? '…' : `₹${commissionToday.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
          subtitle={commissionRate > 0 ? `${commissionRate}% direct rate` : 'No rate set'}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="col-span-2 rounded-lg border bg-card shadow-sm">
          <div className="border-b px-5 py-3">
            <h3 className="font-semibold">Recent Calls</h3>
          </div>
          <div className="divide-y">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No calls yet today.</p>
            ) : (
              recentCalls.map(call => (
                <div key={call.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium relative">
                      {call.lead_username.charAt(0).toUpperCase()}
                      {call.call_mode === 'inbound'
                        ? <PhoneIncoming className="h-3 w-3 text-primary absolute -bottom-0.5 -right-0.5" />
                        : <PhoneOutgoing className="h-3 w-3 text-muted-foreground absolute -bottom-0.5 -right-0.5" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{call.lead_username}</p>
                      <p className="text-xs text-muted-foreground">
                        {call.call_mode === 'inbound' ? 'Inbound' : 'Outbound'} · {Math.floor(call.duration_seconds / 60)}:{(call.duration_seconds % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                  <StatusBadge variant={call.status as any}>{call.disposition || call.status}</StatusBadge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Commission Summary */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Commission Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">This Month</span>
              <span className="font-semibold text-earning">₹{commissionPeriod.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Direct FTDs</span>
              <span className="font-medium">{directFtds}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Network Earnings</span>
              <span className="font-medium">₹{networkEarnings.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
