import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Target, TrendingUp, Clock, BarChart3, Search, Download, CalendarIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { exportToCSV } from '@/lib/exportCSV';

interface CallStats {
  totalCalls: number;
  connectedCalls: number;
  convertedCalls: number;
  missedCalls: number;
  avgDuration: number;
  connectionRate: number;
  conversionRate: number;
}

interface AgentPerf {
  agent_name: string;
  total_calls: number;
  connected: number;
  converted: number;
  avg_duration: number;
  connection_rate: number;
}

interface RecentCall {
  id: string;
  agent_name: string;
  lead_name: string;
  lead_username: string;
  lead_id: string;
  lead_phone_last5: string;
  call_mode: string;
  status: string;
  disposition: string | null;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
  recording_url: string | null;
  attempt_number: number;
}

function resolveDisplayStatus(raw: string, durationSec: number, endedAt: string | null): { label: string; variant: 'success' | 'destructive' | 'warning' | 'outline' | 'default' } {
  const s = (raw || '').toLowerCase();
  if (s === 'completed') return { label: 'Completed', variant: 'success' };
  if (s === 'missed' || s === 'no_answer') return { label: 'Missed', variant: 'destructive' };
  if (s === 'failed' || s === 'error') return { label: 'Failed', variant: 'destructive' };
  if (s === 'busy') return { label: 'Busy', variant: 'warning' };
  if (s === 'cancelled') return { label: 'Cancelled', variant: 'outline' };
  if (s === 'connected' || s === 'on_hold') {
    if (endedAt || durationSec > 0) return { label: 'Completed', variant: 'success' };
    return { label: 'Connected', variant: 'success' };
  }
  if (s === 'ringing' || s === 'initiating') {
    if (endedAt || durationSec > 0) return { label: 'Completed', variant: 'success' };
    return { label: 'Ringing', variant: 'warning' };
  }
  return { label: raw || 'Unknown', variant: 'outline' };
}

export default function AdminCallingDashboard() {
  const [stats, setStats] = useState<CallStats>({ totalCalls: 0, connectedCalls: 0, convertedCalls: 0, missedCalls: 0, avgDuration: 0, connectionRate: 0, conversionRate: 0 });
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [agentPerf, setAgentPerf] = useState<AgentPerf[]>([]);
  const [campaignStats, setCampaignStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Agent list for filter
  const [agents, setAgents] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  // Date filters using Calendar picker
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load agents list once
  useEffect(() => {
    supabase.from('agents').select('id, full_name').eq('status', 'active').order('full_name').then(({ data }) => {
      setAgents(data || []);
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);

    const fromDate = format(dateFrom, 'yyyy-MM-dd');
    const toDate = format(dateTo, 'yyyy-MM-dd');
    const fromISO = timeFrom ? `${fromDate}T${timeFrom}:00` : `${fromDate}T00:00:00`;
    const toISO = timeTo ? `${toDate}T${timeTo}:59` : `${toDate}T23:59:59`;

    let query = supabase
      .from('calls')
      .select('*, agent:agents(id, full_name), lead:leads(id,username,phone_number)')
      .gte('started_at', fromISO)
      .lte('started_at', toISO)
      .order('started_at', { ascending: false })
      .limit(500);

    if (selectedAgent !== 'all') {
      query = query.eq('agent_id', selectedAgent);
    }

    const { data: calls } = await query;

    const callsList: RecentCall[] = (calls || []).map((c: any) => {
      const phoneDigits = (c.lead?.phone_number || '').replace(/\D/g, '');
      return {
        id: c.id,
        agent_name: c.agent?.full_name || 'Unknown',
        lead_name: c.lead?.username || 'Unknown',
        lead_username: c.lead?.username || '',
        lead_id: c.lead_id || '',
        lead_phone_last5: phoneDigits.slice(-5),
        call_mode: c.call_mode || 'manual',
        status: c.status,
        disposition: c.disposition,
        duration_seconds: c.duration_seconds || 0,
        started_at: c.started_at,
        ended_at: c.ended_at,
        recording_url: c.recording_url,
        attempt_number: c.attempt_number || 1,
      };
    });
    setRecentCalls(callsList);

    // Compute stats
    const total = callsList.length;
    const connected = callsList.filter(c => {
      const resolved = resolveDisplayStatus(c.status, c.duration_seconds, c.ended_at);
      return resolved.label === 'Completed' || resolved.label === 'Connected';
    }).length;
    const converted = callsList.filter(c => c.disposition === 'converted').length;
    const missed = callsList.filter(c => {
      const resolved = resolveDisplayStatus(c.status, c.duration_seconds, c.ended_at);
      return resolved.label === 'Missed';
    }).length;
    const totalDuration = callsList.reduce((s, c) => s + c.duration_seconds, 0);

    setStats({
      totalCalls: total,
      connectedCalls: connected,
      convertedCalls: converted,
      missedCalls: missed,
      avgDuration: total ? Math.round(totalDuration / total) : 0,
      connectionRate: total ? Math.round((connected / total) * 100) : 0,
      conversionRate: total ? Math.round((converted / total) * 100) : 0,
    });

    // Agent performance
    const agentMap = new Map<string, AgentPerf>();
    callsList.forEach(c => {
      const existing = agentMap.get(c.agent_name) || {
        agent_name: c.agent_name, total_calls: 0, connected: 0, converted: 0, avg_duration: 0, connection_rate: 0
      };
      existing.total_calls++;
      const resolved = resolveDisplayStatus(c.status, c.duration_seconds, c.ended_at);
      if (resolved.label === 'Completed' || resolved.label === 'Connected') existing.connected++;
      if (c.disposition === 'converted') existing.converted++;
      existing.avg_duration += c.duration_seconds;
      agentMap.set(c.agent_name, existing);
    });
    const perfList = Array.from(agentMap.values()).map(a => ({
      ...a,
      avg_duration: a.total_calls ? Math.round(a.avg_duration / a.total_calls) : 0,
      connection_rate: a.total_calls ? Math.round((a.connected / a.total_calls) * 100) : 0,
    })).sort((a, b) => b.total_calls - a.total_calls);
    setAgentPerf(perfList);

    // Campaigns
    const { data: camps } = await supabase.from('call_campaigns').select('*').order('created_at', { ascending: false }).limit(10);
    setCampaignStats(camps || []);

    setLoading(false);
  }, [dateFrom, dateTo, timeFrom, timeTo, selectedAgent]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredCalls = useMemo(() => {
    if (!searchQuery.trim()) return recentCalls;
    const q = searchQuery.trim().toLowerCase();
    return recentCalls.filter(c =>
      c.lead_id.toLowerCase().includes(q) ||
      c.lead_phone_last5.includes(q) ||
      c.lead_username.toLowerCase().includes(q) ||
      c.agent_name.toLowerCase().includes(q)
    );
  }, [recentCalls, searchQuery]);

  const modeLabel = (m: string) => {
    switch (m) {
      case 'manual': return 'Manual';
      case 'semi_auto': return 'Queue';
      case 'queue': return 'Queue';
      case 'auto': return 'Campaign';
      case 'workspace': return 'Workspace';
      case 'inbound': return 'Inbound';
      case 'priority': return 'Priority';
      default: return m;
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleExport = () => {
    const rows = filteredCalls.map(c => {
      const resolved = resolveDisplayStatus(c.status, c.duration_seconds, c.ended_at);
      return {
        'Time': format(new Date(c.started_at), 'dd MMM, HH:mm'),
        'Lead ID': c.lead_id,
        'User ID': c.lead_username,
        'Phone (Last 5)': c.lead_phone_last5,
        'Agent': c.agent_name,
        'Status': resolved.label,
        'Disposition': c.disposition || '',
        'Mode': modeLabel(c.call_mode),
        'Duration': formatDuration(c.duration_seconds),
        'Attempt': c.attempt_number,
      };
    });
    exportToCSV(rows, `call-monitor-${format(dateFrom, 'yyyy-MM-dd')}`);
  };

  const handleClearFilters = () => {
    const now = new Date();
    setDateFrom(now);
    setDateTo(now);
    setTimeFrom('');
    setTimeTo('');
    setSelectedAgent('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calling Operations Monitor</h1>
        <p className="text-sm text-muted-foreground">Real-time calling activity across all modes</p>
      </div>

      {/* Global Filters Bar */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Date From Picker */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Date From</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[150px] h-9 justify-start text-left font-normal text-sm", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {format(dateFrom, 'dd MMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={d => d && setDateFrom(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To Picker */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Date To</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[150px] h-9 justify-start text-left font-normal text-sm", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {format(dateTo, 'dd MMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={d => d && setDateTo(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time filters */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">From Time</label>
              <Input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} className="w-28 h-9" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">To Time</label>
              <Input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} className="w-28 h-9" />
            </div>

            {/* Agent filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Agent</label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button size="sm" onClick={loadData} className="h-9 gap-1.5">
              <Search className="h-3.5 w-3.5" /> Search
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} className="h-9 gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClearFilters} className="h-9 gap-1.5 text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>

            {/* Search lead */}
            <div className="flex flex-col gap-1 ml-auto">
              <label className="text-xs text-muted-foreground font-medium">Search Lead</label>
              <Input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-48 h-9"
                placeholder="Lead ID, phone last 5, name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Calls', value: stats.totalCalls, icon: Phone, color: 'text-primary' },
          { label: 'Connected', value: stats.connectedCalls, icon: Phone, color: 'text-success' },
          { label: 'Converted', value: stats.convertedCalls, icon: Target, color: 'text-earning' },
          { label: 'Missed', value: stats.missedCalls, icon: PhoneOff, color: 'text-destructive' },
          { label: 'Avg Duration', value: formatDuration(stats.avgDuration), icon: Clock, color: 'text-info' },
          { label: 'Conn Rate', value: `${stats.connectionRate}%`, icon: TrendingUp, color: 'text-success' },
          { label: 'Conv Rate', value: `${stats.conversionRate}%`, icon: BarChart3, color: 'text-earning' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <kpi.icon className={cn('h-4 w-4', kpi.color)} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-xl font-bold mt-1">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent">Recent Calls</TabsTrigger>
          <TabsTrigger value="agents">Agent Performance</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Lead ID</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Disposition</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Recording</TableHead>
                      <TableHead className="text-right">Attempt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCalls.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                          {loading ? 'Loading…' : 'No call records found for the selected period.'}
                        </TableCell>
                      </TableRow>
                    ) : filteredCalls.map(c => {
                      const resolved = resolveDisplayStatus(c.status, c.duration_seconds, c.ended_at);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(c.started_at), 'dd MMM, hh:mm a')}
                          </TableCell>
                          <TableCell className="text-[10px] font-mono text-muted-foreground max-w-[80px] truncate" title={c.lead_id}>
                            {c.lead_id.slice(0, 8)}…
                          </TableCell>
                          <TableCell className="text-sm font-medium">{c.lead_name}</TableCell>
                          <TableCell className="text-xs font-mono">•••••{c.lead_phone_last5}</TableCell>
                          <TableCell className="text-sm">{c.agent_name}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('text-[10px]',
                                resolved.variant === 'success' && 'text-success border-success/30',
                                resolved.variant === 'destructive' && 'text-destructive border-destructive/30',
                                resolved.variant === 'warning' && 'text-amber-600 border-amber-400/30',
                              )}
                            >
                              {resolved.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{c.disposition ? c.disposition.replace(/_/g, ' ') : '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] flex items-center gap-1 w-fit">
                              {c.call_mode === 'inbound'
                                ? <PhoneIncoming className="h-3 w-3 text-primary" />
                                : <PhoneOutgoing className="h-3 w-3 text-muted-foreground" />}
                              {modeLabel(c.call_mode)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{formatDuration(c.duration_seconds)}</TableCell>
                          <TableCell className="text-xs">
                            {c.recording_url ? (
                              <a href={c.recording_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">▶ Play</a>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs">{c.attempt_number}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              Showing stats for {format(dateFrom, 'dd MMM yyyy')}{format(dateFrom, 'yyyy-MM-dd') !== format(dateTo, 'yyyy-MM-dd') ? ` – ${format(dateTo, 'dd MMM yyyy')}` : ''}
              {selectedAgent !== 'all' && ` • Filtered by agent`}
            </p>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => {
              const rows = agentPerf.map(a => ({
                'Agent': a.agent_name,
                'Total Calls': a.total_calls,
                'Connected': a.connected,
                'FTDs': a.converted,
                'Connection Rate': `${a.connection_rate}%`,
                'Avg Duration': formatDuration(a.avg_duration),
              }));
              exportToCSV(rows, `agent-ftds-${format(dateFrom, 'yyyy-MM-dd')}`);
            }}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-center">Total Calls</TableHead>
                    <TableHead className="text-center">Connected</TableHead>
                    <TableHead className="text-center">FTDs</TableHead>
                    <TableHead className="text-center">Conn Rate</TableHead>
                    <TableHead className="text-center">Avg Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentPerf.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No agent data for selected period</TableCell>
                    </TableRow>
                  ) : agentPerf.map(a => (
                    <TableRow key={a.agent_name}>
                      <TableCell className="font-medium">{a.agent_name}</TableCell>
                      <TableCell className="text-center">{a.total_calls}</TableCell>
                      <TableCell className="text-center">{a.connected}</TableCell>
                      <TableCell className="text-center font-bold text-earning">{a.converted}</TableCell>
                      <TableCell className="text-center">{a.connection_rate}%</TableCell>
                      <TableCell className="text-center font-mono text-xs">{formatDuration(a.avg_duration)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Users</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-center">Converted</TableHead>
                    <TableHead className="text-center">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No campaigns yet</TableCell>
                    </TableRow>
                  ) : campaignStats.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{c.status}</Badge></TableCell>
                      <TableCell className="text-center">{c.total_users}</TableCell>
                      <TableCell className="text-center">{c.completed_count}</TableCell>
                      <TableCell className="text-center text-earning font-medium">{c.converted_count}</TableCell>
                      <TableCell className="text-center">{c.total_users ? `${Math.round((c.converted_count / c.total_users) * 100)}%` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
