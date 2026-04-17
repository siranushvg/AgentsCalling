import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { DetailDrawer } from '@/components/DetailDrawer';
import { EarlyLoginRequests } from '@/components/admin/EarlyLoginRequests';
import { supabase } from '@/integrations/supabase/client';
import { Users, Phone, Target, DollarSign, BarChart3, AlertTriangle, RefreshCw, CalendarIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getISTToday() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
}

function getISTMidnightUTC(dateStr: string) {
  return new Date(dateStr + 'T00:00:00+05:30').toISOString();
}

function getISTWeekStart() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  ist.setUTCDate(ist.getUTCDate() - diff);
  return ist.toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countdown, setCountdown] = useState(60);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  // Date picker state
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());

  // Live data state
  const [agents, setAgents] = useState<any[]>([]);
  const [activeAgentCount, setActiveAgentCount] = useState(0);
  const [totalDials, setTotalDials] = useState(0);
  const [totalFTDs, setTotalFTDs] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [queueHealth, setQueueHealth] = useState(0);
  const [hourlyData, setHourlyData] = useState<{ hour: string; dials: number; ftds: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; commission: number; ftds: number }[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [shiftCoverage, setShiftCoverage] = useState<{ shift: string; count: number; total: number }[]>([]);
  // Per-agent FTD tracking
  const [agentFTDs, setAgentFTDs] = useState<{ agent_name: string; ftds: number; ftd_amount: number; dials: number; commission: number }[]>([]);
  const [totalFTDAmount, setTotalFTDAmount] = useState(0);

  const fetchAll = useCallback(async () => {
    const todayStr = getISTToday();
    const fromStr = format(dateFrom, 'yyyy-MM-dd');
    const toStr = format(dateTo, 'yyyy-MM-dd');
    const fromISO = getISTMidnightUTC(fromStr);
    const toEndISO = getISTMidnightUTC(
      new Date(new Date(toStr).getTime() + 86400000).toISOString().slice(0, 10)
    );
    const todayISO = getISTMidnightUTC(todayStr);
    const tomorrowISO = getISTMidnightUTC(
      new Date(new Date(todayStr).getTime() + 86400000).toISOString().slice(0, 10)
    );
    const weekStartISO = getISTMidnightUTC(getISTWeekStart());

    const [
      agentsRes,
      activeSessionsRes,
      dashStatsRes,
      rangeCommRes,
      leadsInQueueRes,
      totalLeadsRes,
      weekCallsRes,
      weekCommRes,
      flagsRes,
      shiftsRes,
      shiftTemplatesRes,
    ] = await Promise.all([
      supabase.from('agents').select('id, full_name, email, city, status, languages, referral_code, training_completed, training_progress, created_at, user_id').order('full_name'),
      supabase.from('profiles').select('id').eq('session_status', 'active').gte('last_activity_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()),
      supabase.rpc('get_dashboard_stats', { p_from: fromISO, p_to: toEndISO }),
      supabase.from('commissions').select('amount').gte('created_at', fromISO).lt('created_at', toEndISO),
      supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['new', 'assigned', 'callback']),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.rpc('get_dashboard_stats', { p_from: weekStartISO, p_to: tomorrowISO }),
      supabase.from('commissions').select('amount, created_at').gte('created_at', weekStartISO).lt('created_at', tomorrowISO),
      supabase.from('low_activity_flags').select('id, agent_id, flag_type, severity, details, resolved, created_at').eq('resolved', false).order('created_at', { ascending: false }).limit(20),
      supabase.from('agent_shifts').select('agent_id, shift_template_id, is_off_day').eq('date', todayStr),
      supabase.from('shift_templates').select('id, name, start_time, end_time'),
    ]);

    const allAgents = agentsRes.data || [];
    setAgents(allAgents);

    const activeUserIds = new Set((activeSessionsRes.data || []).map(p => p.id));
    const liveActiveCount = allAgents.filter(a => a.user_id && activeUserIds.has(a.user_id)).length;
    setActiveAgentCount(liveActiveCount);

    // Dashboard stats from server-side aggregation
    const dashStats = (dashStatsRes.data || {}) as Record<string, any>;
    setTotalDials(Number(dashStats?.total_dials ?? 0));
    setTotalFTDs(Number(dashStats?.total_ftds ?? 0));
    setTotalFTDAmount(Number(dashStats?.total_ftd_amount ?? 0));

    // Per-agent stats from server
    const agentStats = (dashStats?.agent_stats || []) as { agent_id: string; agent_name: string; dials: number; ftds: number; ftd_amount: number; commission: number }[];
    setAgentFTDs(agentStats.map(a => ({ agent_name: a.agent_name, dials: Number(a.dials), ftds: Number(a.ftds), ftd_amount: Number(a.ftd_amount ?? 0), commission: Number(a.commission ?? 0) })));

    // Range commission
    const commTotal = (rangeCommRes.data || []).reduce((s, c) => s + Number(c.amount), 0);
    setTotalCommission(commTotal);

    // Queue health
    const inQueue = leadsInQueueRes.count || 0;
    const totalLeads = totalLeadsRes.count || 1;
    setQueueHealth(Math.round((inQueue / totalLeads) * 100));

    // Hourly/daily data from server-side aggregation
    const hourlyStats = (dashStats?.hourly_stats || []) as { hour: number; day: string; dials: number; ftds: number }[];
    const isSingleDay = fromStr === toStr;
    if (isSingleDay) {
      const hours: { hour: string; dials: number; ftds: number }[] = [];
      for (let h = 0; h < 24; h++) {
        hours.push({ hour: `${h}:00`, dials: 0, ftds: 0 });
      }
      hourlyStats.forEach(s => {
        const h = Number(s.hour);
        if (hours[h]) {
          hours[h].dials = Number(s.dials);
          hours[h].ftds = Number(s.ftds);
        }
      });
      setHourlyData(hours.filter((_, i) => i >= 8 && i <= 22));
    } else {
      // Multi-day: aggregate by day
      const dayMap = new Map<string, { dials: number; ftds: number }>();
      hourlyStats.forEach(s => {
        const dayKey = format(new Date(s.day), 'dd MMM');
        const existing = dayMap.get(dayKey) || { dials: 0, ftds: 0 };
        existing.dials += Number(s.dials);
        existing.ftds += Number(s.ftds);
        dayMap.set(dayKey, existing);
      });
      setHourlyData(Array.from(dayMap.entries()).map(([hour, data]) => ({ hour, ...data })));
    }

    // Weekly data (always current week) — use server-side aggregated stats
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekStats = (weekCallsRes.data || {}) as Record<string, any>;
    const weekHourly = (Array.isArray(weekStats?.hourly_stats) ? weekStats.hourly_stats : []) as { hour: number; day: string; dials: number; ftds: number }[];
    const weekComm = weekCommRes.data || [];
    const weekMap: Record<string, { commission: number; ftds: number }> = {};
    dayNames.forEach(d => { weekMap[d] = { commission: 0, ftds: 0 }; });

    weekHourly.forEach(s => {
      const d = new Date(s.day);
      const dow = d.getUTCDay();
      const dayName = dayNames[dow === 0 ? 6 : dow - 1];
      if (dayName) weekMap[dayName].ftds += Number(s.ftds);
    });
    weekComm.forEach(c => {
      const ist = new Date(new Date(c.created_at).getTime() + IST_OFFSET_MS);
      const dow = ist.getUTCDay();
      const dayName = dayNames[dow === 0 ? 6 : dow - 1];
      weekMap[dayName].commission += Number(c.amount);
    });
    setWeeklyData(dayNames.map(d => ({ day: d, ...weekMap[d] })));

    // Flags
    const enrichedFlags = (flagsRes.data || []).map(f => {
      const agent = allAgents.find(a => a.id === f.agent_id);
      return { ...f, agent_name: agent?.full_name || 'Unknown' };
    });
    setFlags(enrichedFlags);

    // Shift coverage
    const templates = shiftTemplatesRes.data || [];
    const todayShifts = shiftsRes.data || [];
    const coverage = templates.map(t => {
      const assigned = todayShifts.filter(s => s.shift_template_id === t.id && !s.is_off_day);
      const online = assigned.filter(s => {
        const agent = allAgents.find(a => a.id === s.agent_id);
        return agent?.user_id && activeUserIds.has(agent.user_id);
      });
      return { shift: `${t.name} (${t.start_time.slice(0, 5)}-${t.end_time.slice(0, 5)})`, count: online.length, total: assigned.length };
    });
    setShiftCoverage(coverage);

    setLastRefresh(new Date());
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchAll();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Realtime subscriptions
  useEffect(() => {
    const ch1 = supabase.channel('admin-dash-calls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, fetchAll)
      .subscribe();
    const ch2 = supabase.channel('admin-dash-commissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commissions' }, fetchAll)
      .subscribe();
    const ch3 = supabase.channel('admin-dash-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchAll)
      .subscribe();
    const ch4 = supabase.channel('admin-dash-ftd-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ftd_events' }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
      supabase.removeChannel(ch4);
    };
  }, [fetchAll]);

  const handleAvatarClick = (name: string) => {
    const agent = agents.find(a => a.full_name === name);
    if (agent) setSelectedAgent(agent);
  };

  const isToday = format(dateFrom, 'yyyy-MM-dd') === getISTToday() && format(dateTo, 'yyyy-MM-dd') === getISTToday();
  const isSingleDay = format(dateFrom, 'yyyy-MM-dd') === format(dateTo, 'yyyy-MM-dd');
  const dateLabel = isToday ? 'Today' : isSingleDay ? format(dateFrom, 'dd MMM yyyy') : `${format(dateFrom, 'dd MMM')} – ${format(dateTo, 'dd MMM yyyy')}`;

  return (
    <div className="space-y-6">
      {/* Header with date picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-9 justify-start text-left font-normal text-sm gap-1.5")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(dateFrom, 'dd MMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={d => d && setDateFrom(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-9 justify-start text-left font-normal text-sm gap-1.5")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(dateTo, 'dd MMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={d => d && setDateTo(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          {!isToday && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setDateFrom(new Date()); setDateTo(new Date()); }}>
              Reset to Today
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className={`h-3 w-3 ${countdown <= 5 ? 'animate-spin' : ''}`} />
          <span>Auto-refresh in {countdown}s · Last: {lastRefresh.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-4">
        <KPICard
          title="Active Agents"
          value={`${activeAgentCount}/${agents.filter(a => a.status === 'active').length}`}
          icon={<Users className="h-5 w-5" />}
          avatars={agents.filter(a => a.status === 'active').map(a => a.full_name)}
          onAvatarClick={handleAvatarClick}
        />
        <KPICard title={`Total Dials`} value={totalDials} icon={<Phone className="h-5 w-5" />} />
        <KPICard title={`Verified FTDs`} value={totalFTDs} icon={<Target className="h-5 w-5" />} subtitle={`₹${totalFTDAmount.toLocaleString()}`} />
        <KPICard title={`Commission`} value={`₹${totalCommission.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
        <KPICard title="Queue Health" value={`${queueHealth}%`} icon={<BarChart3 className="h-5 w-5" />} />
      </div>

      {/* Early Login Requests */}
      <EarlyLoginRequests />

      <div className="grid grid-cols-3 gap-6">
        {/* Hourly/Daily Heatmap Chart */}
        <div className="col-span-2 rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4">{isSingleDay ? `Hourly Operations (${dateLabel})` : `Daily Operations (${dateLabel})`}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourlyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="dials" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Dials" />
              <Bar dataKey="ftds" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} name="FTDs" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts & Flags */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-5 py-3 flex items-center justify-between">
              <h3 className="font-semibold">Activity Flags</h3>
              <span className="text-xs bg-destructive/15 text-destructive px-2 py-0.5 rounded-full font-medium">{flags.length}</span>
            </div>
            <div className="divide-y max-h-48 overflow-y-auto">
              {flags.length === 0 ? (
                <p className="px-5 py-4 text-xs text-muted-foreground text-center">No unresolved flags</p>
              ) : flags.map(flag => (
                <div key={flag.id} className="px-5 py-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium">{flag.agent_name}</p>
                        <StatusBadge variant={flag.severity}>{flag.severity}</StatusBadge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{flag.details}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-3">Shift Coverage</h3>
            <div className="space-y-2">
              {shiftCoverage.length === 0 ? (
                <p className="text-xs text-muted-foreground">No shifts configured for today</p>
              ) : shiftCoverage.map(s => (
                <div key={s.shift}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.shift}</span>
                    <span className="font-medium">{s.count}/{s.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${s.total > 0 ? (s.count / s.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Agent FTD Breakdown + Weekly Chart */}
      <div className="grid grid-cols-2 gap-6">
        {/* Agent FTD table */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-5 py-3 flex items-center justify-between">
            <h3 className="font-semibold">Agent FTDs <span className="text-xs font-normal text-muted-foreground ml-1">({dateLabel})</span></h3>
            <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded-full font-bold">{totalFTDs} verified · ₹{totalFTDAmount.toLocaleString()}</span>
          </div>
          <div className="overflow-y-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Agent</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">Dials</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">FTDs</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">FTD Amount</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">Commission</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">Conv %</th>
                </tr>
              </thead>
              <tbody>
                {agentFTDs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">No calls in selected period</td></tr>
                ) : agentFTDs.map(a => (
                  <tr key={a.agent_name} className="border-b hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2 font-medium text-xs">{a.agent_name}</td>
                    <td className="px-4 py-2 text-center text-xs">{a.dials}</td>
                    <td className="px-4 py-2 text-center font-bold text-earning">{a.ftds}</td>
                    <td className="px-4 py-2 text-center text-xs font-semibold text-success">₹{a.ftd_amount.toLocaleString()}</td>
                    <td className="px-4 py-2 text-center text-xs font-semibold text-earning">₹{a.commission.toLocaleString()}</td>
                    <td className="px-4 py-2 text-center text-xs text-muted-foreground">{a.dials > 0 ? Math.round((a.ftds / a.dials) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekly Revenue Chart */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4">Weekly Commission & FTDs</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `₹${v / 1000}k`} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(value: number) => [`₹${value.toLocaleString()}`, '']} />
              <Area type="monotone" dataKey="commission" fill="hsl(var(--success) / 0.2)" stroke="hsl(var(--success))" name="Commission" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Status Summary */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">All Agents ({agents.length})</h3>
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Agent</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Languages</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id} className="border-b hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => setSelectedAgent(agent)}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {agent.full_name.charAt(0)}
                      </div>
                      <span className="font-medium text-xs">{agent.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center"><StatusBadge variant={agent.status}>{agent.status}</StatusBadge></td>
                  <td className="px-4 py-2 text-[11px] text-muted-foreground">{(agent.languages || []).slice(0, 2).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Profile Drawer */}
      <DetailDrawer open={!!selectedAgent} onClose={() => setSelectedAgent(null)} title={selectedAgent?.full_name || ''} subtitle={selectedAgent?.status}>
        {selectedAgent && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                {selectedAgent.full_name.split(' ').map((w: string) => w[0]).join('').toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-semibold">{selectedAgent.full_name}</h2>
                <p className="text-sm text-muted-foreground">{selectedAgent.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">City</p>
                <p className="text-sm font-medium">{selectedAgent.city}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge variant={selectedAgent.status}>{selectedAgent.status}</StatusBadge>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Referral Code</p>
                <p className="text-sm font-medium font-mono">{selectedAgent.referral_code}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Training</p>
                <p className="text-sm font-medium">{selectedAgent.training_completed ? 'Completed' : `${selectedAgent.training_progress}/6 modules`}</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Languages</p>
              <div className="flex flex-wrap gap-1.5">
                {(selectedAgent.languages || []).map((lang: string) => (
                  <span key={lang} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{lang}</span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Joined</p>
              <p className="text-sm font-medium">{new Date(selectedAgent.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
