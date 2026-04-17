import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Download, Clock, Play, Square, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AttendancePayrollReport from '@/components/admin/AttendancePayrollReport';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportToCSV } from '@/lib/exportCSV';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Convert UTC timestamp to IST display string */
function toIST(utcStr: string, format: 'short' | 'full' = 'short'): string {
  const d = new Date(utcStr);
  const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const day = String(ist.getUTCDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mon = months[ist.getUTCMonth()];
  const h = ist.getUTCHours();
  const m = String(ist.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  if (format === 'full') {
    return `${day} ${mon} ${ist.getUTCFullYear()}, ${h12}:${m} ${ampm} IST`;
  }
  return `${day} ${mon}, ${h12}:${m} ${ampm}`;
}

/** Determine if a call is inbound based on call_mode */
function isInbound(callMode: string): boolean {
  return callMode === 'inbound';
}

/** Get direction label */
function getDirectionLabel(callMode: string): { label: string; isIn: boolean } {
  const isIn = isInbound(callMode);
  return { label: isIn ? 'Inbound' : 'Outbound', isIn };
}

function resolveStatus(raw: string, durationSec: number, endedAt: string | null): { label: string; style: string } {
  const s = (raw || '').toLowerCase();
  if (s === 'completed') return { label: 'completed', style: 'bg-success/15 text-success' };
  if (s === 'missed' || s === 'no_answer') return { label: 'missed', style: 'bg-warning/15 text-warning' };
  if (s === 'failed' || s === 'error') return { label: 'failed', style: 'bg-destructive/15 text-destructive' };
  if (s === 'busy') return { label: 'busy', style: 'bg-warning/15 text-warning' };
  if (s === 'cancelled') return { label: 'cancelled', style: 'bg-muted text-muted-foreground' };
  if (s === 'connected' || s === 'on_hold') {
    if (endedAt || durationSec > 0) return { label: 'completed', style: 'bg-success/15 text-success' };
    return { label: 'connected', style: 'bg-success/15 text-success' };
  }
  if (s === 'ringing' || s === 'initiating') {
    if (endedAt || durationSec > 0) return { label: 'completed', style: 'bg-success/15 text-success' };
    return { label: 'ringing', style: 'bg-muted text-muted-foreground' };
  }
  return { label: raw || 'unknown', style: 'bg-muted text-muted-foreground' };
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-4 border-b last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
function RecordingPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
      title={isPlaying ? 'Stop' : 'Play recording'}
    >
      {isPlaying ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
      <span>{isPlaying ? 'Stop' : 'Play'}</span>
    </button>
  );
}

export default function AdminReports() {
  // Use IST for "today" default
  const nowIST = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
  const today = nowIST.toISOString().slice(0, 10);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [agentFilter, setAgentFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [queueFilter, setQueueFilter] = useState('all');
  const [mainTab, setMainTab] = useState('reports');
  const [subTab, setSubTab] = useState('call-report');

  // Pending attendance requests count for badge
  const { data: pendingRequestsCount = 0 } = useQuery({
    queryKey: ['admin-pending-attendance-requests-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('attendance_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Fetch calls for range — use IST (UTC+5:30) boundaries
  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['admin-report-calls', dateFrom, dateTo],
    queryFn: async () => {
      const fromISO = new Date(dateFrom + 'T00:00:00+05:30').toISOString();
      const toISO = new Date(dateTo + 'T23:59:59+05:30').toISOString();
      const { data } = await supabase
        .from('calls')
        .select('id, agent_id, lead_id, status, disposition, duration_seconds, started_at, ended_at, call_mode, campaign_id, queue_id, attempt_number, notes, recording_url')
        .gte('started_at', fromISO)
        .lte('started_at', toISO)
        .order('started_at', { ascending: true });
      return data || [];
    },
  });

  // Fetch agents & campaigns for filters
  const { data: agents = [] } = useQuery({
    queryKey: ['admin-report-agents'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, full_name').order('full_name');
      return data || [];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['admin-report-campaigns-list'],
    queryFn: async () => {
      const { data } = await supabase.from('call_campaigns').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: queues = [] } = useQuery({
    queryKey: ['admin-report-queues-list'],
    queryFn: async () => {
      const { data } = await supabase.from('call_queues').select('id, name').order('name');
      return data || [];
    },
  });

  // Apply filters including search
  const filtered = useMemo(() => {
    let result = calls;
    if (agentFilter !== 'all') result = result.filter(c => c.agent_id === agentFilter);
    if (campaignFilter !== 'all') result = result.filter(c => c.campaign_id === campaignFilter);
    if (queueFilter !== 'all') result = result.filter(c => c.queue_id === queueFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(c => {
        const agentName = agents.find(a => a.id === c.agent_id)?.full_name?.toLowerCase() || '';
        return agentName.includes(term) ||
          (c.disposition || '').toLowerCase().includes(term) ||
          (c.status || '').toLowerCase().includes(term) ||
          (c.call_mode || '').toLowerCase().includes(term) ||
          (c.lead_id || '').toLowerCase().includes(term);
      });
    }
    return result;
  }, [calls, agentFilter, campaignFilter, queueFilter, searchTerm, agents]);

  // Hourly distribution (0-23) in IST
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 48 }, (_, i) => {
      const h = Math.floor(i / 2);
      const m = i % 2 === 0 ? '00' : '30';
      return { slot: `${String(h).padStart(2, '0')}:${m}`, calls: 0 };
    });
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    filtered.forEach(c => {
      const utcMs = new Date(c.started_at).getTime();
      const istDate = new Date(utcMs + IST_OFFSET_MS);
      const idx = istDate.getUTCHours() * 2 + (istDate.getUTCMinutes() >= 30 ? 1 : 0);
      if (hours[idx]) hours[idx].calls++;
    });
    return hours;
  }, [filtered]);

  // Compute stats
  const stats = useMemo(() => {
    const total = filtered.length;
    const connected = filtered.filter(c => {
      const r = resolveStatus(c.status, c.duration_seconds, c.ended_at);
      return r.label === 'completed' || r.label === 'connected';
    });
    const missed = filtered.filter(c => resolveStatus(c.status, c.duration_seconds, c.ended_at).label === 'missed');
    const failed = filtered.filter(c => resolveStatus(c.status, c.duration_seconds, c.ended_at).label === 'failed');
    const outbound = filtered.filter(c => c.call_mode !== 'inbound');
    const inbound = filtered.filter(c => c.call_mode === 'inbound');
    const outboundSuccess = outbound.filter(c => c.status === 'connected' || c.status === 'completed');
    const outboundFail = outbound.filter(c => c.status === 'missed' || c.status === 'failed');
    const converted = filtered.filter(c => c.disposition === 'converted');

    const totalDuration = filtered.reduce((s, c) => s + c.duration_seconds, 0);
    const outboundDuration = outbound.reduce((s, c) => s + c.duration_seconds, 0);
    const connectedDuration = connected.reduce((s, c) => s + c.duration_seconds, 0);

    const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;
    const avgTalkTime = connected.length > 0 ? Math.round(connectedDuration / connected.length) : 0;

    return {
      total,
      inbound: inbound.length,
      outbound: outbound.length,
      missed: missed.length,
      failed: failed.length,
      outboundSuccess: outboundSuccess.length,
      outboundFail: outboundFail.length,
      converted: converted.length,
      totalDuration,
      outboundDuration,
      connectedDuration,
      avgDuration,
      avgTalkTime,
    };
  }, [filtered]);

  // Agent breakdown for call history
  const agentBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; dials: number; connected: number; ftds: number; talkSec: number }>();
    filtered.forEach(c => {
      const entry = map.get(c.agent_id) || { name: '', dials: 0, connected: 0, ftds: 0, talkSec: 0 };
      entry.dials++;
      const r = resolveStatus(c.status, c.duration_seconds, c.ended_at);
      if (r.label === 'completed' || r.label === 'connected') { entry.connected++; entry.talkSec += c.duration_seconds; }
      if (c.disposition === 'converted') entry.ftds++;
      map.set(c.agent_id, entry);
    });
    agents.forEach(a => {
      const entry = map.get(a.id);
      if (entry) entry.name = a.full_name;
    });
    return Array.from(map.values()).sort((a, b) => b.dials - a.dials);
  }, [filtered, agents]);

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
  };

  const handleExport = () => {
    const rows = filtered.map(c => ({
      started_at: c.started_at,
      agent_id: c.agent_id,
      agent_name: agents.find(a => a.id === c.agent_id)?.full_name || c.agent_id,
      status: c.status,
      disposition: c.disposition || '',
      duration_seconds: c.duration_seconds,
      call_mode: c.call_mode,
      attempt: c.attempt_number,
    }));
    exportToCSV(rows, `call-report-${dateFrom}-to-${dateTo}`);
  };

  return (
    <div className="space-y-5">
      {/* Top level tabs: Reports & Monitor / Realtime Monitoring */}
      <div className="flex items-center gap-10 border-b">
        <button
          onClick={() => setMainTab('reports')}
          className={`pb-2 text-lg font-bold border-b-2 transition-colors ${mainTab === 'reports' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Reports & Monitor
        </button>
        <button
          onClick={() => setMainTab('realtime')}
          className={`pb-2 text-lg font-bold border-b-2 transition-colors ${mainTab === 'realtime' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Realtime Monitoring
        </button>
      </div>

      {mainTab === 'reports' && (
        <>
          {/* Sub tabs */}
          <Tabs value={subTab} onValueChange={setSubTab}>
            <TabsList className="bg-transparent gap-1 border-b rounded-none p-0 h-auto">
              {[
                { value: 'call-report', label: 'Call Report' },
                { value: 'call-history', label: 'Call History' },
                { value: 'agent-performance', label: 'Agent Performance' },
                { value: 'call-history-agent', label: 'Call History by Agent' },
                { value: 'attendance-payroll', label: 'Attendance & Payroll' },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm relative"
                >
                  {tab.label}
                  {tab.value === 'attendance-payroll' && pendingRequestsCount > 0 && (
                    <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-1">
                      {pendingRequestsCount}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Filters bar */}
            <div className="rounded-lg border bg-card p-4 shadow-sm mt-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[280px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Time</label>
                  <div className="flex items-center gap-1">
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs h-9 w-[155px]" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs h-9 w-[155px]" />
                  </div>
                </div>
                <div className="min-w-[160px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Agent</label>
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger className="h-9 text-xs w-[160px]">
                      <SelectValue placeholder="All agents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All agents</SelectItem>
                      {agents.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign</label>
                  <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                    <SelectTrigger className="h-9 text-xs w-[160px]">
                      <SelectValue placeholder="All campaigns" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All campaigns</SelectItem>
                      {campaigns.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Queue</label>
                  <Select value={queueFilter} onValueChange={setQueueFilter}>
                    <SelectTrigger className="h-9 text-xs w-[160px]">
                      <SelectValue placeholder="All queues" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All queues</SelectItem>
                      {queues.map(q => (
                        <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[180px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
                  <Input
                    type="text"
                    placeholder="Agent, status, disposition…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="text-xs h-9 w-[180px]"
                  />
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={handleExport}>
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                </div>
              </div>
            </div>

            {/* Call Report Tab */}
            <TabsContent value="call-report" className="space-y-5 mt-0">
              {/* Title */}
              <div className="text-center pt-4">
                <h3 className="text-base font-semibold">
                  Total Calls ({new Date(dateFrom).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {new Date(dateTo).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })})
                </h3>
              </div>

              {/* Hourly Chart */}
              <div className="rounded-lg border bg-card p-5 shadow-sm">
                {isLoading ? (
                  <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="slot" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" interval={1} angle={-45} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="calls" stroke="hsl(var(--info))" strokeWidth={2} dot={{ r: 3 }} name="Total Calls" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Stats Grid — 3 columns like Voicelay */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border bg-card shadow-sm">
                  <StatRow label="Total Calls" value={stats.total} />
                  <StatRow label="Total Inbound Calls" value={stats.inbound} />
                  <StatRow label="Total Outbound Calls" value={stats.outbound} />
                  <StatRow label="Total Missed Calls" value={stats.missed} />
                  <StatRow label="Outbound Calls Success" value={stats.outboundSuccess} />
                  <StatRow label="Outbound Calls Not Success" value={stats.outboundFail} />
                </div>
                <div className="rounded-lg border bg-card shadow-sm">
                  <StatRow label="Total Call Duration" value={formatDuration(stats.totalDuration)} />
                  <StatRow label="Total Outbound Duration" value={formatDuration(stats.outboundDuration)} />
                  <StatRow label="Total Talk Time" value={formatDuration(stats.connectedDuration)} />
                  <StatRow label="Average Call Duration" value={formatDuration(stats.avgDuration)} />
                  <StatRow label="Average Talk Time" value={formatDuration(stats.avgTalkTime)} />
                  <StatRow label="Total Conversions (FTDs)" value={stats.converted} />
                </div>
                <div className="rounded-lg border bg-card shadow-sm">
                  <StatRow label="Contact Rate" value={`${stats.total > 0 ? ((stats.outboundSuccess / Math.max(stats.outbound, 1)) * 100).toFixed(1) : 0}%`} />
                  <StatRow label="Conversion Rate" value={`${stats.outboundSuccess > 0 ? ((stats.converted / stats.outboundSuccess) * 100).toFixed(1) : 0}%`} />
                  <StatRow label="Avg Attempts per Lead" value={stats.total > 0 ? (filtered.reduce((s, c) => s + c.attempt_number, 0) / stats.total).toFixed(1) : '0'} />
                  <StatRow label="Failed Calls" value={stats.failed} />
                  <StatRow label="Active Agents" value={new Set(filtered.map(c => c.agent_id)).size} />
                  <StatRow label="Unique Leads Called" value={new Set(filtered.map(c => c.lead_id)).size} />
                </div>
              </div>
            </TabsContent>

            {/* Call History Tab */}
            <TabsContent value="call-history" className="mt-0">
              <div className="rounded-lg border bg-card shadow-sm mt-4">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground text-xs">Time</th>
                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground text-xs">Agent</th>
                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs">Status</th>
                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs">Disposition</th>
                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs">Direction</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">Duration</th>
                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs">Recording</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">Attempt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice().reverse().map(c => (
                        <tr key={c.id} className="border-b hover:bg-accent/30 transition-colors">
                          <td className="px-3 py-2 text-xs tabular-nums">{toIST(c.started_at)}</td>
                          <td className="px-3 py-2 text-xs">{agents.find(a => a.id === c.agent_id)?.full_name || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            {(() => { const r = resolveStatus(c.status, c.duration_seconds, c.ended_at); return (
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.style}`}>{r.label}</span>
                            ); })()}
                          </td>
                          <td className="px-3 py-2 text-center text-xs text-muted-foreground">{c.disposition?.replace(/_/g, ' ') || '—'}</td>
                          <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                            {(() => { const dir = getDirectionLabel(c.call_mode); return (
                              <span className="inline-flex items-center gap-1">
                                {dir.isIn
                                  ? <PhoneIncoming className="h-3 w-3 text-primary" />
                                  : <PhoneOutgoing className="h-3 w-3 text-muted-foreground" />}
                                {dir.label}
                              </span>
                            ); })()}
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums">{formatDuration(c.duration_seconds)}</td>
                          <td className="px-3 py-2 text-center">
                            {c.recording_url ? (
                              <RecordingPlayer url={c.recording_url} />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums">{c.attempt_number}</td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No calls found for this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* Agent Performance Tab */}
            <TabsContent value="agent-performance" className="mt-0">
              <div className="rounded-lg border bg-card shadow-sm mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">#</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Agent</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Total Dials</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Connected</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">FTDs</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Contact Rate</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Conv Rate</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Talk Time</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Avg Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentBreakdown.map((a, i) => (
                        <tr key={a.name} className="border-b hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-2 text-xs text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                {a.name.charAt(0)}
                              </div>
                              <span className="font-medium text-xs">{a.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs">{a.dials}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs">{a.connected}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs font-bold">{a.ftds}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs">{a.dials > 0 ? ((a.connected / a.dials) * 100).toFixed(1) : 0}%</td>
                          <td className="px-4 py-2 text-right font-mono text-xs">{a.connected > 0 ? ((a.ftds / a.connected) * 100).toFixed(1) : 0}%</td>
                          <td className="px-4 py-2 text-right font-mono text-xs">{formatDuration(a.talkSec)}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs">{a.dials > 0 ? formatDuration(Math.round(a.talkSec / a.dials)) : '00:00:00'}</td>
                        </tr>
                      ))}
                      {agentBreakdown.length === 0 && (
                        <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">No agent data for this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* Call History by Agent Tab */}
            <TabsContent value="call-history-agent" className="mt-0">
              <div className="space-y-4 mt-4">
                {agentBreakdown.length === 0 ? (
                  <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">No data for this period.</div>
                ) : (
                  agentBreakdown.map(agent => {
                    const agentCalls = filtered.filter(c => {
                      const a = agents.find(ag => ag.full_name === agent.name);
                      return a && c.agent_id === a.id;
                    }).slice().reverse();
                    return (
                      <div key={agent.name} className="rounded-lg border bg-card shadow-sm">
                        <div className="border-b px-4 py-3 flex items-center justify-between bg-muted/30">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {agent.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{agent.name}</p>
                              <p className="text-[11px] text-muted-foreground">{agent.dials} dials · {agent.connected} connected · {agent.ftds} FTDs</p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">Talk: {formatDuration(agent.talkSec)}</span>
                        </div>
                        <div className="overflow-x-auto max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-card">
                              <tr className="border-b bg-muted/30">
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground text-[11px]">Time</th>
                                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-[11px]">Direction</th>
                                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-[11px]">Status</th>
                                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-[11px]">Disposition</th>
                                <th className="px-3 py-2 text-right font-medium text-muted-foreground text-[11px]">Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {agentCalls.map(c => (
                                <tr key={c.id} className="border-b hover:bg-accent/20">
                                  <td className="px-3 py-1.5 text-[11px] tabular-nums">{toIST(c.started_at)}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {(() => { const dir = getDirectionLabel(c.call_mode); return (
                                      <span className="inline-flex items-center gap-1 text-[10px]">
                                        {dir.isIn
                                          ? <><PhoneIncoming className="h-3 w-3 text-primary" /> In</>
                                          : <><PhoneOutgoing className="h-3 w-3 text-muted-foreground" /> Out</>}
                                      </span>
                                    ); })()}
                                  </td>
                                  <td className="px-3 py-1.5 text-center">
                                    {(() => { const r = resolveStatus(c.status, c.duration_seconds, c.ended_at); return (
                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${r.style}`}>{r.label}</span>
                                    ); })()}
                                  </td>
                                  <td className="px-3 py-1.5 text-center text-[11px] text-muted-foreground">{c.disposition?.replace(/_/g, ' ') || '—'}</td>
                                  <td className="px-3 py-1.5 text-right text-[11px] tabular-nums">{formatDuration(c.duration_seconds)}</td>
                                </tr>
                              ))}
                              {agentCalls.length === 0 && (
                                <tr><td colSpan={5} className="px-3 py-4 text-center text-xs text-muted-foreground">No calls.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* Attendance & Payroll Tab */}
            <TabsContent value="attendance-payroll" className="mt-0">
              <div className="mt-4">
                <AttendancePayrollReport />
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {mainTab === 'realtime' && (
        <div className="space-y-4">
          <Tabs defaultValue="call-monitoring">
            <TabsList className="bg-transparent gap-1 border-b rounded-none p-0 h-auto">
              {['Call Monitoring', 'Agent Monitoring', 'Queue Monitoring'].map(tab => (
                <TabsTrigger
                  key={tab}
                  value={tab.toLowerCase().replace(/ /g, '-')}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="call-monitoring">
              <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground mt-4">
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="font-medium">Real-time call monitoring</p>
                <p className="text-xs mt-1">Active call streams will appear here when agents are on live calls.</p>
              </div>
            </TabsContent>
            <TabsContent value="agent-monitoring">
              <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground mt-4">
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="font-medium">Agent activity monitoring</p>
                <p className="text-xs mt-1">Live agent statuses, current calls, and idle times will appear here.</p>
              </div>
            </TabsContent>
            <TabsContent value="queue-monitoring">
              <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground mt-4">
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="font-medium">Queue monitoring</p>
                <p className="text-xs mt-1">Queue depths, wait times, and SLA metrics will appear here.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
