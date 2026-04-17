import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { DetailDrawer } from '@/components/DetailDrawer';
import { exportToCSV } from '@/lib/exportCSV';
import { maskPhone } from '@/lib/maskPhone';
import { Eye, EyeOff, Search, Download, RefreshCw, Loader2, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { toast } from 'sonner';

interface LeadRow {
  id: string;
  username: string;
  phone_number: string;
  email: string | null;
  state: string;
  language: string;
  temperature: string;
  status: string;
  source: string;
  score: number;
  potential_commission: number;
  total_call_attempts: number;
  last_called_at: string | null;
  assigned_agent_id: string | null;
  created_at: string;
  suppressed: boolean;
}

interface AgentRow {
  id: string;
  full_name: string;
}

interface CallRow {
  id: string;
  lead_id: string;
  status: string;
  disposition: string | null;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
  call_mode: string;
  notes: string | null;
  agent_id: string;
}

const PAGE_SIZE = 50;

export default function AdminLeads() {
  const queryClient = useQueryClient();
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [dispositionFilter, setDispositionFilter] = useState('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [revealReason, setRevealReason] = useState('');
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // ── Fetch leads ──────────────────────────────────────────────────────
  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['admin-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, username, phone_number, email, state, language, temperature, status, source, score, potential_commission, total_call_attempts, last_called_at, assigned_agent_id, created_at, suppressed')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as LeadRow[];
    },
  });

  // ── Fetch agents for name mapping ────────────────────────────────────
  const { data: agents = [] } = useQuery({
    queryKey: ['admin-leads-agents'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, full_name').order('full_name');
      return (data || []) as AgentRow[];
    },
  });

  const agentMap = useMemo(() => {
    const m = new Map<string, string>();
    agents.forEach(a => m.set(a.id, a.full_name));
    return m;
  }, [agents]);

  // ── Fetch latest disposition per lead (most recent call) ─────────────
  const { data: latestCalls = [] } = useQuery({
    queryKey: ['admin-leads-latest-calls'],
    queryFn: async () => {
      const { data } = await supabase
        .from('calls')
        .select('id, lead_id, disposition, status, duration_seconds, started_at, ended_at, call_mode, notes, agent_id')
        .order('started_at', { ascending: false });
      return (data || []) as CallRow[];
    },
  });

  // Map lead_id → latest call with disposition
  const latestDispositionMap = useMemo(() => {
    const m = new Map<string, CallRow>();
    latestCalls.forEach(c => {
      if (!m.has(c.lead_id)) m.set(c.lead_id, c);
    });
    return m;
  }, [latestCalls]);

  // ── Realtime subscription ────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('admin-leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-leads-latest-calls'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ── Filtering ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = !search || l.username.toLowerCase().includes(search.toLowerCase()) || l.state.toLowerCase().includes(search.toLowerCase()) || (l.email || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;
      const matchSource = sourceFilter === 'all' || l.source === sourceFilter;
      const matchDisposition = dispositionFilter === 'all' || (latestDispositionMap.get(l.id)?.disposition || '') === dispositionFilter;
      return matchSearch && matchStatus && matchSource && matchDisposition;
    });
  }, [leads, search, statusFilter, sourceFilter, dispositionFilter, latestDispositionMap]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, statusFilter, sourceFilter, dispositionFilter]);

  const selectedLead = leads.find(l => l.id === selectedLeadId) || null;
  const leadCalls = (id: string) => latestCalls.filter(c => c.lead_id === id);

  // ── Phone reveal ─────────────────────────────────────────────────────
  const handleRevealRequest = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (revealedIds.has(id)) {
      setRevealedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      setPendingRevealId(id);
    }
  };

  const confirmReveal = () => {
    if (!pendingRevealId || !revealReason.trim()) return;
    setRevealedIds(prev => new Set(prev).add(pendingRevealId));
    toast.success('Phone revealed. Reason logged to audit.');
    setPendingRevealId(null);
    setRevealReason('');
  };

  // ── Export ────────────────────────────────────────────────────────────
  const handleExport = () => {
    exportToCSV(
      filtered.map(l => ({
        Username: l.username,
        State: l.state,
        Language: l.language,
        Temperature: l.temperature,
        Status: l.status,
        Source: l.source,
        Score: l.score,
        Commission: l.potential_commission,
        Agent: agentMap.get(l.assigned_agent_id || '') || 'Unassigned',
        'Call Attempts': l.total_call_attempts,
        'Last Disposition': latestDispositionMap.get(l.id)?.disposition?.replace(/_/g, ' ') || '—',
        'Last Called': l.last_called_at ? new Date(l.last_called_at).toLocaleString('en-IN') : '—',
      })),
      'leads'
    );
    toast.success('Leads exported to CSV');
  };

  return (
    <div className="space-y-4">
      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search by name, state, email…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="all">All Status</option>
          {['new', 'assigned', 'contacted', 'callback', 'converted', 'expired', 'not_interested'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="all">All Sources</option>
          {['ad_campaign', 'organic', 'direct'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={dispositionFilter} onChange={e => setDispositionFilter(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="all">All Dispositions</option>
          {['interested', 'callback', 'not_interested', 'no_answer', 'wrong_number', 'language_mismatch', 'converted'].map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={() => refetchLeads()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* ── Summary bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</span>
        <span>•</span>
        <span>{leads.filter(l => l.status === 'converted').length} converted</span>
        <span>•</span>
        <span>{leads.filter(l => l.status === 'new').length} new</span>
        <span>•</span>
        <span>{leads.filter(l => l.status === 'contacted').length} contacted</span>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      {leadsLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading leads…
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs w-10">#</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Username</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Phone</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Agent</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">State</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Language</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Temp</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Status</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Disposition</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Source</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Attempts</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Last Called</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">No leads found</td></tr>
              ) : paginated.map((lead, idx) => {
                const latestCall = latestDispositionMap.get(lead.id);
                return (
                  <tr key={lead.id} className="border-b hover:bg-accent/30 cursor-pointer transition-colors" onClick={() => setSelectedLeadId(lead.id)}>
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{page * PAGE_SIZE + idx + 1}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{lead.username}</td>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{revealedIds.has(lead.id) ? lead.phone_number : maskPhone(lead.phone_number)}</span>
                        <button onClick={e => handleRevealRequest(lead.id, e)} className="text-muted-foreground hover:text-foreground">
                          {revealedIds.has(lead.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{agentMap.get(lead.assigned_agent_id || '') || <span className="text-muted-foreground">Unassigned</span>}</td>
                    <td className="px-3 py-2 text-xs">{lead.state}</td>
                    <td className="px-3 py-2 text-center text-xs">{lead.language}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge variant={lead.temperature as any}>{lead.temperature}</StatusBadge></td>
                    <td className="px-3 py-2 text-center"><StatusBadge variant={lead.status as any}>{lead.status.replace(/_/g, ' ')}</StatusBadge></td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">{latestCall?.disposition?.replace(/_/g, ' ') || '—'}</td>
                    <td className="px-3 py-2 text-center text-xs">{lead.source.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-center text-xs tabular-nums">{lead.total_call_attempts}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {lead.last_called_at
                        ? new Date(lead.last_called_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
              <span>Page {page + 1} of {totalPages}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Phone Reveal Modal ───────────────────────────────────────── */}
      {pendingRevealId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-xl space-y-4">
            <h3 className="font-semibold">Phone Number Reveal</h3>
            <p className="text-sm text-muted-foreground">Please provide a reason for revealing this customer's phone number. This will be logged to the audit trail.</p>
            <textarea
              value={revealReason}
              onChange={e => setRevealReason(e.target.value)}
              placeholder="Reason for reveal..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPendingRevealId(null); setRevealReason(''); }}>Cancel</Button>
              <Button onClick={confirmReveal} disabled={!revealReason.trim()}>Reveal & Log</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lead Detail Drawer ───────────────────────────────────────── */}
      <DetailDrawer
        open={!!selectedLead}
        onClose={() => setSelectedLeadId(null)}
        title={selectedLead?.username || ''}
        subtitle={selectedLead ? `${selectedLead.state} · ${selectedLead.language}` : ''}
      >
        {selectedLead && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-muted-foreground">Temperature</p><StatusBadge variant={selectedLead.temperature as any}>{selectedLead.temperature}</StatusBadge></div>
              <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge variant={selectedLead.status as any}>{selectedLead.status.replace(/_/g, ' ')}</StatusBadge></div>
              <div><p className="text-xs text-muted-foreground">Score</p><p className="text-sm font-bold">{selectedLead.score}</p></div>
              <div><p className="text-xs text-muted-foreground">Commission</p><p className="text-sm font-bold text-earning">₹{selectedLead.potential_commission}</p></div>
              <div><p className="text-xs text-muted-foreground">Source</p><p className="text-sm">{selectedLead.source.replace(/_/g, ' ')}</p></div>
              <div><p className="text-xs text-muted-foreground">Registered</p><p className="text-sm">{new Date(selectedLead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
              <div><p className="text-xs text-muted-foreground">Agent</p><p className="text-sm">{agentMap.get(selectedLead.assigned_agent_id || '') || 'Unassigned'}</p></div>
              <div><p className="text-xs text-muted-foreground">Call Attempts</p><p className="text-sm font-bold">{selectedLead.total_call_attempts}</p></div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">CALL HISTORY</h4>
              {leadCalls(selectedLead.id).length > 0 ? leadCalls(selectedLead.id).slice(0, 20).map(c => (
                <div key={c.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s</p>
                      <p className="text-xs text-muted-foreground">{new Date(c.started_at).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge variant={c.status as any}>{c.status}</StatusBadge>
                      {c.disposition && <StatusBadge variant={c.disposition as any}>{c.disposition.replace(/_/g, ' ')}</StatusBadge>}
                    </div>
                  </div>
                  {c.notes && <p className="text-xs text-muted-foreground italic">"{c.notes}"</p>}
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Agent: {agentMap.get(c.agent_id) || c.agent_id} ·
                    {c.call_mode === 'inbound'
                      ? <><PhoneIncoming className="h-3 w-3 text-primary" /> Inbound</>
                      : <><PhoneOutgoing className="h-3 w-3 text-muted-foreground" /> {c.call_mode}</>}
                  </p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No calls recorded</p>}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
