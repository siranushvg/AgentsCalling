import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { DetailDrawer } from '@/components/DetailDrawer';
import { exportToCSV } from '@/lib/exportCSV';
import { Search, Download, UserX, RotateCcw, ArrowUpDown, Info, Loader2, UserPlus, ShieldPlus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KPICard } from '@/components/KPICard';
import { CreateUserModal } from '@/components/admin/CreateUserModal';
import { AgentEditDrawerFields } from '@/components/admin/AgentEditDrawerFields';
import type { AgentStatus, AppRole } from '@/types';
import { AdminAgentNetworkSection } from '@/components/admin/AdminAgentNetworkSection';

interface DBAgent {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  city: string;
  languages: string[];
  referral_code: string;
  referred_by: string | null;
  status: AgentStatus;
  team_lead_id: string | null;
  training_completed: boolean;
  training_progress: number;
  created_at: string;
  user_id: string | null;
  monthly_salary: number;
}

interface AgentWithRole extends DBAgent {
  role: AppRole;
}

function formatActiveTime(minutes: number): string {
  if (minutes <= 0) return '0h 00m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

type SortField = 'name' | 'status' | 'avgTime';
type SortDir = 'asc' | 'desc';
type TimeFilter = 'all' | 'lt2' | '2to4' | '4to6' | 'gt6';

export default function AdminAgents() {
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentWithRole | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalRole, setCreateModalRole] = useState<'agent' | 'admin'>('agent');

  const [agents, setAgents] = useState<AgentWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTimeMap, setActiveTimeMap] = useState<Record<string, { avgMinutesPerDay: number; todayMinutes: number; weekMinutes: number; activeDays: number }>>({});
  const [agentCallsMap, setAgentCallsMap] = useState<Record<string, any[]>>({});
  const [agentCommissionsMap, setAgentCommissionsMap] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      // Fetch agents
      const { data: agentsData, error: agentsErr } = await supabase
        .from('agents')
        .select('*')
        .order('full_name');

      if (agentsErr) throw agentsErr;

      // Fetch roles for all agents with user_ids
      const userIds = (agentsData || []).filter(a => a.user_id).map(a => a.user_id!);
      let rolesMap: Record<string, AppRole> = {};
      
      if (userIds.length > 0) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);
        
        if (rolesData) {
          rolesData.forEach(r => { rolesMap[r.user_id] = r.role as AppRole; });
        }
      }

      // Fetch active time from agent_sessions
      const { data: sessionsData } = await supabase
        .from('agent_sessions')
        .select('agent_id, active_minutes, shift_date');

      const timeMap: Record<string, { avgMinutesPerDay: number; todayMinutes: number; weekMinutes: number; activeDays: number }> = {};
      if (sessionsData) {
        const today = new Date().toISOString().slice(0, 10);
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        
        const byAgent: Record<string, typeof sessionsData> = {};
        sessionsData.forEach(s => {
          if (!byAgent[s.agent_id]) byAgent[s.agent_id] = [];
          byAgent[s.agent_id].push(s);
        });

        Object.entries(byAgent).forEach(([agentId, sessions]) => {
          const uniqueDays = new Set(sessions.map(s => s.shift_date));
          const totalMins = sessions.reduce((sum, s) => sum + s.active_minutes, 0);
          const todayMins = sessions.filter(s => s.shift_date === today).reduce((sum, s) => sum + s.active_minutes, 0);
          const weekMins = sessions.filter(s => s.shift_date >= weekAgo).reduce((sum, s) => sum + s.active_minutes, 0);
          
          timeMap[agentId] = {
            avgMinutesPerDay: uniqueDays.size > 0 ? Math.round(totalMins / uniqueDays.size) : 0,
            todayMinutes: todayMins,
            weekMinutes: weekMins,
            activeDays: uniqueDays.size,
          };
        });
      }
      setActiveTimeMap(timeMap);

      // Fetch calls
      const { data: callsData } = await supabase
        .from('calls')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(500);

      const callsMap: Record<string, any[]> = {};
      if (callsData) {
        callsData.forEach(c => {
          if (!callsMap[c.agent_id]) callsMap[c.agent_id] = [];
          if (callsMap[c.agent_id].length < 5) callsMap[c.agent_id].push(c);
        });
      }
      setAgentCallsMap(callsMap);

      // Fetch commissions
      const { data: commissionsData } = await supabase
        .from('commissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      const commMap: Record<string, any[]> = {};
      if (commissionsData) {
        commissionsData.forEach(c => {
          if (!commMap[c.agent_id]) commMap[c.agent_id] = [];
          if (commMap[c.agent_id].length < 5) commMap[c.agent_id].push(c);
        });
      }
      setAgentCommissionsMap(commMap);

      // Combine agents with roles
      const combined: AgentWithRole[] = (agentsData || []).map(a => ({
        ...a,
        role: (a.user_id && rolesMap[a.user_id]) ? rolesMap[a.user_id] : 'agent' as AppRole,
      }));

      setAgents(combined);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const getAvgMinutes = (id: string) => activeTimeMap[id]?.avgMinutesPerDay ?? -1;

  const filtered = useMemo(() => {
    let list = agents.filter(a =>
      a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      a.city.toLowerCase().includes(search.toLowerCase())
    );

    if (timeFilter !== 'all') {
      list = list.filter(a => {
        const mins = getAvgMinutes(a.id);
        if (mins < 0) return timeFilter === 'lt2';
        const hrs = mins / 60;
        switch (timeFilter) {
          case 'lt2': return hrs < 2;
          case '2to4': return hrs >= 2 && hrs < 4;
          case '4to6': return hrs >= 4 && hrs < 6;
          case 'gt6': return hrs >= 6;
          default: return true;
        }
      });
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.full_name.localeCompare(b.full_name);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'avgTime':
          cmp = getAvgMinutes(a.id) - getAvgMinutes(b.id);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [agents, search, timeFilter, sortField, sortDir, activeTimeMap]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleExport = () => {
    exportToCSV(
      filtered.map(a => ({
        Name: a.full_name,
        Email: a.email,
        City: a.city,
        Languages: a.languages.join('; '),
        Role: a.role,
        Status: a.status,
        Training: a.training_completed ? 'Complete' : `${a.training_progress}/6`,
        'Avg Active Hours/Day': formatActiveTime(Math.max(0, getAvgMinutes(a.id))),
      })),
      'agents'
    );
    toast.success('Agents exported to CSV');
  };

  const renderActiveTimeCell = (agentId: string, status: string) => {
    const data = activeTimeMap[agentId];
    if (!data || data.activeDays === 0) {
      if (status === 'training' || status === 'pending') {
        return <span className="text-xs text-muted-foreground italic">New</span>;
      }
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    return (
      <span className="text-sm font-medium tabular-nums">
        {formatActiveTime(data.avgMinutesPerDay)}
      </span>
    );
  };

  const selectedActiveTime = selectedAgent ? activeTimeMap[selectedAgent.id] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading agents...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search agents..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Active time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              <SelectItem value="lt2">Less than 2h</SelectItem>
              <SelectItem value="2to4">2h – 4h</SelectItem>
              <SelectItem value="4to6">4h – 6h</SelectItem>
              <SelectItem value="gt6">6h+</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => { setCreateModalRole('agent'); setCreateModalOpen(true); }}>
            <UserPlus className="h-4 w-4 mr-1" /> Create Agent
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setCreateModalRole('admin'); setCreateModalOpen(true); }}>
            <ShieldPlus className="h-4 w-4 mr-1" /> Create Admin
          </Button>
        </div>

        <div className="rounded-lg border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    <span className="inline-flex items-center gap-1">Name <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">City</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Languages</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('status')}>
                    <span className="inline-flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('avgTime')}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1">
                          Avg Active / Day <Info className="h-3 w-3 opacity-40" /> <ArrowUpDown className="h-3 w-3 opacity-40" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] text-xs">
                        Average daily active time based on call activity, not total login time.
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">Training</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No agents found
                    </td>
                  </tr>
                ) : filtered.map(agent => (
                  <tr key={agent.id} className="border-b hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => setSelectedAgent(agent)}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {agent.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{agent.full_name}</p>
                          <p className="text-xs text-muted-foreground">{agent.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{agent.city}</td>
                    <td className="px-4 py-2.5 text-xs">{agent.languages.join(', ')}</td>
                    <td className="px-4 py-2.5 text-center">
                      <StatusBadge variant={agent.role === 'team_lead' ? 'active' : 'new'}>
                        {agent.role === 'team_lead' ? 'Team Lead' : agent.role === 'admin' ? 'Admin' : 'Agent'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-2.5 text-center"><StatusBadge variant={agent.status}>{agent.status}</StatusBadge></td>
                    <td className="px-4 py-2.5 text-center">{renderActiveTimeCell(agent.id, agent.status)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {agent.training_completed
                        ? <StatusBadge variant="completed">Complete</StatusBadge>
                        : <StatusBadge variant="training">{agent.training_progress}/6</StatusBadge>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(agent)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agent Detail Drawer */}
        <DetailDrawer
          open={!!selectedAgent}
          onClose={() => setSelectedAgent(null)}
          title={selectedAgent?.full_name || ''}
          subtitle={selectedAgent?.email}
        >
          {selectedAgent && (
            <div className="space-y-6">
              {/* Active Time KPIs */}
              {selectedActiveTime && selectedActiveTime.activeDays > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">ACTIVE TIME</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <KPICard
                      title="Avg Active / Day"
                      value={formatActiveTime(selectedActiveTime.avgMinutesPerDay)}
                      subtitle={`Based on ${selectedActiveTime.activeDays} active days`}
                    />
                    <KPICard
                      title="Today"
                      value={formatActiveTime(selectedActiveTime.todayMinutes)}
                      subtitle="Active call time today"
                    />
                    <KPICard
                      title="This Week"
                      value={formatActiveTime(selectedActiveTime.weekMinutes)}
                      subtitle="Total active this week"
                    />
                    <KPICard
                      title="Last 7 Days Avg"
                      value={formatActiveTime(Math.round(selectedActiveTime.weekMinutes / 7))}
                      subtitle="Daily average last 7 days"
                    />
                  </div>
                </div>
              )}

              {/* Profile */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">PROFILE</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge variant={selectedAgent.status}>{selectedAgent.status}</StatusBadge></div>
                  <div><p className="text-xs text-muted-foreground">Referral Code</p><p className="text-sm font-mono">{selectedAgent.referral_code}</p></div>
                  <div><p className="text-xs text-muted-foreground">Referred By</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{selectedAgent.referred_by || '—'}</p>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                        const val = prompt('Enter referral code for ' + selectedAgent.full_name, selectedAgent.referred_by || '');
                        if (val !== null) {
                          supabase.from('agents').update({ referred_by: val.toUpperCase() || null }).eq('id', selectedAgent.id).then(({ error }) => {
                            if (error) { toast.error('Failed to update referral code'); }
                            else { toast.success('Referred by updated'); fetchAgents(); }
                          });
                        }
                      }}><Pencil className="h-3 w-3 text-muted-foreground" /></Button>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Monthly Salary</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">₹{(selectedAgent.monthly_salary || 0).toLocaleString()}</span>
                      <Button variant="outline" size="sm" onClick={() => {
                        const val = prompt('Enter new monthly salary for ' + selectedAgent.full_name, String(selectedAgent.monthly_salary || 0));
                        if (val !== null && !isNaN(Number(val))) {
                          supabase.from('agents').update({ monthly_salary: Number(val) }).eq('id', selectedAgent.id).then(({ error }) => {
                            if (error) { toast.error('Failed to update salary'); }
                            else { toast.success('Salary updated'); fetchAgents(); }
                          });
                        }
                      }}>Edit</Button>
                    </div>
                  </div>
                </div>

                {/* Editable fields: City, Languages, Joining Date */}
                <AgentEditDrawerFields
                  agentId={selectedAgent.id}
                  city={selectedAgent.city}
                  languages={selectedAgent.languages}
                  joiningDate={(selectedAgent as any).joining_date || null}
                  onUpdated={fetchAgents}
                />
              </div>

              {/* Recent Calls */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">RECENT CALLS</h4>
                {(agentCallsMap[selectedAgent.id] || []).length > 0 ? (
                  <div className="space-y-2">
                    {(agentCallsMap[selectedAgent.id] || []).map((c: any) => (
                      <div key={c.id} className="rounded-lg border p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Call #{c.id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">{Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s</p>
                        </div>
                        <StatusBadge variant={c.status}>{c.disposition || c.status}</StatusBadge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No calls recorded</p>
                )}
              </div>

              {/* Commission History */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">COMMISSIONS</h4>
                {(agentCommissionsMap[selectedAgent.id] || []).length > 0 ? (
                  <div className="space-y-2">
                    {(agentCommissionsMap[selectedAgent.id] || []).map((c: any) => (
                      <div key={c.id} className="rounded-lg border p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">₹{Number(c.amount).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{c.tier} · {c.rate_used}%</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No commissions yet</p>
                )}
              </div>

              {/* Referral Network */}
              <AdminAgentNetworkSection agentId={selectedAgent.id} />

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" size="sm"><RotateCcw className="h-4 w-4 mr-1" /> Reset Password</Button>
                {selectedAgent.status === 'active' && (
                  <Button variant="destructive" size="sm" onClick={async () => {
                    if (!confirm(`Suspend ${selectedAgent.full_name}? They will be unable to log in.`)) return;
                    const { error } = await supabase.from('agents').update({ status: 'suspended' as any }).eq('id', selectedAgent.id);
                    if (error) { toast.error('Failed to suspend agent'); return; }
                    // Ban the auth user so they cannot log in
                    if (selectedAgent.user_id) {
                      const { error: banErr } = await supabase.functions.invoke('admin-ban-user', {
                        body: { user_id: selectedAgent.user_id, action: 'ban' },
                      });
                      if (banErr) toast.error('Agent suspended but auth ban failed');
                    }
                    toast.success(`${selectedAgent.full_name} has been suspended`);
                    setSelectedAgent(null);
                    fetchAgents();
                  }}><UserX className="h-4 w-4 mr-1" /> Suspend</Button>
                )}
                {selectedAgent.status === 'suspended' && (
                  <Button variant="default" size="sm" onClick={async () => {
                    if (!confirm(`Reactivate ${selectedAgent.full_name}?`)) return;
                    const { error } = await supabase.from('agents').update({ status: 'active' as any }).eq('id', selectedAgent.id);
                    if (error) { toast.error('Failed to reactivate agent'); return; }
                    if (selectedAgent.user_id) {
                      await supabase.functions.invoke('admin-ban-user', {
                        body: { user_id: selectedAgent.user_id, action: 'unban' },
                      });
                    }
                    toast.success(`${selectedAgent.full_name} has been reactivated`);
                    setSelectedAgent(null);
                    fetchAgents();
                  }}><RotateCcw className="h-4 w-4 mr-1" /> Reactivate</Button>
                )}
              </div>
            </div>
          )}
        </DetailDrawer>
        <CreateUserModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={fetchAgents}
          defaultRole={createModalRole}
        />
      </div>
    </TooltipProvider>
  );
}
