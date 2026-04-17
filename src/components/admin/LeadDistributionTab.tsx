import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { DetailDrawer } from '@/components/DetailDrawer';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Users, Search, X, FileText, UserCheck, Clock, AlertTriangle, UserPlus, RefreshCw, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface DistributionLead {
  id: string;
  username: string;
  phone_number: string;
  email: string | null;
  state: string;
  language: string;
  status: string;
  source: string;
  campaign_id: string | null;
  temperature: string;
  score: number;
  potential_commission: number;
  assigned_agent_id: string | null;
  import_batch_id: string | null;
  import_date: string | null;
  import_timestamp: string | null;
  imported_by_admin: string | null;
  created_at: string;
  updated_at: string;
  signup_at: string;
  agent_name?: string;
  importer_name?: string;
}

interface AgentOption {
  id: string;
  full_name: string;
  languages: string[];
  city: string;
  status: string;
}

export function LeadDistributionTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [leads, setLeads] = useState<DistributionLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<DistributionLead | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkAgent, setBulkAgent] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [summaryStats, setSummaryStats] = useState({ assigned: 0, unassigned: 0, pending: 0 });
  const [redistributing, setRedistributing] = useState(false);
  const [recentRedistLogs, setRecentRedistLogs] = useState<{ action: string; details: string; created_at: string }[]>([]);

  // Load recent redistribution logs
  const loadRedistLogs = useCallback(async () => {
    const { data } = await supabase
      .from('activity_log')
      .select('action, details, created_at')
      .in('action', ['auto_leads_redistributed', 'auto_redistribute_failed'])
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setRecentRedistLogs(data);
  }, []);

  const handleRedistributeAll = async () => {
    setRedistributing(true);
    try {
      const { data, error } = await supabase.rpc('redistribute_all_leads_equally', {
        p_trigger_reason: 'manual_admin',
        p_triggered_by: user?.id,
      });
      if (error) throw error;
      const res = data as { redistributed?: number; agents?: number; error?: string } | null;
      if (res?.error) {
        toast({ title: 'Redistribution issue', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Leads redistributed', description: `${res.redistributed} leads distributed across ${res.agents} active agents.` });
        loadPage(currentPage);
        loadMeta();
        loadRedistLogs();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRedistributing(false);
    }
  };

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterAssignment, setFilterAssignment] = useState('all');
  const [filterImportDate, setFilterImportDate] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 500;

  // Filter option lists (fetched once)
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [importDates, setImportDates] = useState<string[]>([]);
  const [agentNames, setAgentNames] = useState<string[]>([]);

  // Load filter options + summary stats once
  const loadMeta = useCallback(async () => {
    const [agentsRes, statsRes] = await Promise.all([
      supabase.from('agents').select('id, full_name, languages, city, status').eq('status', 'active').order('full_name'),
      supabase.from('leads').select('import_batch_id, language, source, import_date, assigned_agent_id, status', { count: 'exact' }).not('import_batch_id', 'is', null),
    ]);
    if (agentsRes.data) setAgents(agentsRes.data as AgentOption[]);

    // Derive filter options from stats query (limited to 1000 but good enough for distinct values)
    // For accurate distinct values we'll use separate small queries
    const [batchRes, langRes, srcRes, dateRes] = await Promise.all([
      supabase.from('leads').select('import_batch_id').not('import_batch_id', 'is', null).order('import_batch_id'),
      supabase.from('leads').select('language').not('import_batch_id', 'is', null),
      supabase.from('leads').select('source').not('import_batch_id', 'is', null),
      supabase.from('leads').select('import_date').not('import_batch_id', 'is', null).not('import_date', 'is', null).order('import_date', { ascending: false }),
    ]);

    setBatchIds([...new Set((batchRes.data ?? []).map(r => r.import_batch_id).filter(Boolean))] as string[]);
    setLanguages([...new Set((langRes.data ?? []).map(r => r.language).filter(Boolean))].sort() as string[]);
    setSources([...new Set((srcRes.data ?? []).map(r => r.source).filter(Boolean))].sort() as string[]);
    setImportDates([...new Set((dateRes.data ?? []).map(r => r.import_date).filter(Boolean))] as string[]);

    // Summary stats – use exact count queries to avoid the 1000-row default limit
    const total = statsRes.count ?? 0;
    const [assignedRes, pendingRes] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('import_batch_id', 'is', null).not('assigned_agent_id', 'is', null),
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('import_batch_id', 'is', null).eq('status', 'new').is('assigned_agent_id', null),
    ]);
    const assigned = assignedRes.count ?? 0;
    const pending = pendingRes.count ?? 0;
    setTotalCount(total);
    setSummaryStats({ assigned, unassigned: total - assigned, pending });

    // Agent name filter options
    const agentNameList = (agentsRes.data ?? []).map(a => a.full_name);
    setAgentNames(agentNameList);
  }, []);

  // Server-side paginated data load
  const loadPage = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const from = (page - 1) * ROWS_PER_PAGE;
      const to = from + ROWS_PER_PAGE - 1;

      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .not('import_batch_id', 'is', null)
        .order('created_at', { ascending: false });

      // Apply server-side filters
      if (filterBatch !== 'all') query = query.eq('import_batch_id', filterBatch);
      if (filterStatus !== 'all') query = query.eq('status', filterStatus as 'new' | 'assigned' | 'contacted' | 'callback' | 'converted' | 'expired' | 'not_interested');
      if (filterLanguage !== 'all') query = query.eq('language', filterLanguage);
      if (filterSource !== 'all') query = query.eq('source', filterSource as 'ad_campaign' | 'organic' | 'direct');
      if (filterImportDate !== 'all') query = query.eq('import_date', filterImportDate);
      if (filterAssignment === 'assigned') query = query.not('assigned_agent_id', 'is', null);
      if (filterAssignment === 'unassigned') query = query.is('assigned_agent_id', null);
      if (filterAgent !== 'all') query = query.eq('assigned_agent_id', filterAgent);
      if (filterDateFrom) query = query.gte('import_date', filterDateFrom);
      if (filterDateTo) query = query.lte('import_date', filterDateTo);
      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`username.ilike.${q},phone_number.ilike.${q},email.ilike.${q},state.ilike.${q}`);
      }

      const { data, count, error } = await query.range(from, to);
      if (error) throw error;

      const rawLeads = data ?? [];
      setTotalCount(count ?? 0);

      // Enrich with agent/importer names
      const agentIds = [...new Set(rawLeads.map(l => l.assigned_agent_id).filter(Boolean))] as string[];
      const adminIds = [...new Set(rawLeads.map(l => l.imported_by_admin).filter(Boolean))] as string[];

      const [agentsNameRes, profilesRes] = await Promise.all([
        agentIds.length > 0 ? supabase.from('agents').select('id, full_name').in('id', agentIds) : Promise.resolve({ data: [] }),
        adminIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', adminIds) : Promise.resolve({ data: [] }),
      ]);

      const agentMap = new Map((agentsNameRes.data ?? []).map(a => [a.id, a.full_name]));
      const profileMap = new Map((profilesRes.data ?? []).map(p => [p.id, p.full_name]));

      const enriched: DistributionLead[] = rawLeads.map(l => ({
        ...l,
        agent_name: l.assigned_agent_id ? (agentMap.get(l.assigned_agent_id) || 'Unknown Agent') : undefined,
        importer_name: l.imported_by_admin ? (profileMap.get(l.imported_by_admin) || 'Admin') : undefined,
      }));

      setLeads(enriched);
    } catch (err) {
      console.error('Failed to load distribution data:', err);
      setLeads([]);
    }
    setLoading(false);
  }, [filterBatch, filterAgent, filterStatus, filterLanguage, filterSource, filterImportDate, filterAssignment, filterDateFrom, filterDateTo, searchQuery]);

  useEffect(() => { loadMeta(); loadRedistLogs(); }, [loadMeta, loadRedistLogs]);
  useEffect(() => { loadPage(currentPage); }, [currentPage, loadPage]);


  // Reload current page helper
  const reloadCurrentPage = useCallback(() => loadPage(currentPage), [loadPage, currentPage]);

  // Assign a single lead to an agent
  const assignLeadToAgent = useCallback(async (leadId: string, agentId: string) => {
    setAssigning(true);
    const { error } = await supabase
      .from('leads')
      .update({ assigned_agent_id: agentId, status: 'assigned', updated_at: new Date().toISOString() })
      .eq('id', leadId);

    if (error) {
      toast({ title: 'Assignment failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Lead assigned', description: 'Lead has been assigned to the selected agent.' });
      await reloadCurrentPage();
    }
    setAssigning(false);
  }, [reloadCurrentPage, toast]);

  // Bulk assign selected leads
  const bulkAssign = useCallback(async () => {
    if (!bulkAgent || selectedLeadIds.size === 0) return;
    setAssigning(true);

    const ids = Array.from(selectedLeadIds);
    const { error } = await supabase
      .from('leads')
      .update({ assigned_agent_id: bulkAgent, status: 'assigned', updated_at: new Date().toISOString() })
      .in('id', ids);

    if (error) {
      toast({ title: 'Bulk assignment failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Leads assigned', description: `${ids.length} leads assigned successfully.` });
      setSelectedLeadIds(new Set());
      setBulkAgent('');
      await reloadCurrentPage();
    }
    setAssigning(false);
  }, [bulkAgent, selectedLeadIds, reloadCurrentPage, toast]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filterBatch, filterAgent, filterStatus, filterLanguage, filterSource, filterAssignment, filterImportDate, filterDateFrom, filterDateTo, searchQuery]);

  // Since filtering is now server-side, leads IS the current page
  const totalPages = Math.max(1, Math.ceil(totalCount / ROWS_PER_PAGE));
  const paginatedLeads = leads;

  const totalImported = totalCount;
  const totalAssigned = summaryStats.assigned;
  const totalUnassigned = summaryStats.unassigned;
  const totalPending = summaryStats.pending;

  const clearFilters = () => {
    setSearchQuery('');
    setFilterBatch('all');
    setFilterAgent('all');
    setFilterStatus('all');
    setFilterLanguage('all');
    setFilterSource('all');
    setFilterAssignment('all');
    setFilterImportDate('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasActiveFilters = searchQuery || filterBatch !== 'all' || filterAgent !== 'all' || filterStatus !== 'all' || filterLanguage !== 'all' || filterSource !== 'all' || filterAssignment !== 'all' || filterImportDate !== 'all' || filterDateFrom || filterDateTo;

  const maskPhone = (phone: string) => {
    if (phone.length <= 4) return phone;
    return phone.slice(0, -4).replace(/./g, '•') + phone.slice(-4);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const shortBatchId = (id: string | null) => id ? id.slice(0, 8) : '—';

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const visibleIds = paginatedLeads.map(l => l.id);
    if (visibleIds.length > 0 && visibleIds.every(id => selectedLeadIds.has(id))) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(visibleIds));
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Users className="h-10 w-10" />
          <p className="text-sm font-semibold">No imported leads yet</p>
          <p className="text-xs max-w-sm text-center">Imported CSV rows will appear here once uploaded and distributed.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalImported}</p>
              <p className="text-xs text-muted-foreground">Total Imported</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAssigned}</p>
              <p className="text-xs text-muted-foreground">Assigned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalUnassigned}</p>
              <p className="text-xs text-muted-foreground">Unassigned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Redistribute All + Recent Logs */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">Lead Redistribution</p>
                <p className="text-xs text-muted-foreground">Leads are auto-redistributed when new agents are activated. Use the button for manual rebalancing.</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={redistributing} size="sm" className="gap-2">
                  {redistributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Redistribute All Leads
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Redistribute All Leads?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reassign <span className="font-semibold text-foreground">all available leads</span> equally across all currently active agents, including newly registered agents. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRedistributeAll}>
                    Yes, Redistribute Now
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {recentRedistLogs.length > 0 && (
            <div className="border-t pt-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" /> Recent redistribution events</p>
              {recentRedistLogs.map((log, i) => {
                let parsed: any = {};
                try { parsed = JSON.parse(log.details); } catch {}
                const reason = parsed.trigger_reason === 'new_agent_activated' ? '🤖 Auto (new agent)' : parsed.trigger_reason === 'manual_admin' ? '👤 Manual' : log.action === 'auto_redistribute_failed' ? '⚠️ Failed' : '🔄 System';
                return (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{reason}</span>
                    <span>—</span>
                    <span>{parsed.redistributed ?? 0} leads → {parsed.agents ?? 0} agents</span>
                    <span className="ml-auto">{new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Assign Bar */}
      {selectedLeadIds.size > 0 && (
        <Card className="border-primary">
          <CardContent className="pt-4 pb-4 flex items-center gap-3 flex-wrap">
            <UserPlus className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-medium">{selectedLeadIds.size} lead{selectedLeadIds.size > 1 ? 's' : ''} selected</span>
            <Select value={bulkAgent} onValueChange={setBulkAgent}>
              <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue placeholder="Assign to agent..." /></SelectTrigger>
              <SelectContent>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name} — {a.languages.join(', ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={bulkAssign} disabled={!bulkAgent || assigning}>
              {assigning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Assign {selectedLeadIds.size} Lead{selectedLeadIds.size > 1 ? 's' : ''}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedLeadIds(new Set()); setBulkAgent(''); }}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search + Filters */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email, agent…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
                <X className="h-3 w-3" /> Clear filters
              </Button>
            )}
            <p className="text-xs text-muted-foreground ml-auto">{totalCount} total rows</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filterImportDate} onValueChange={setFilterImportDate}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Import Date" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                {importDates.map(d => <SelectItem key={d} value={d}>{formatDate(d)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterBatch} onValueChange={setFilterBatch}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Batch ID" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {batchIds.map(b => <SelectItem key={b} value={b}>{shortBatchId(b)}…</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue placeholder="Agent" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterAssignment} onValueChange={setFilterAssignment}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Assignment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {['new', 'assigned', 'contacted', 'callback', 'converted', 'expired', 'not_interested'].map(s => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterLanguage} onValueChange={setFilterLanguage}>
              <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Language" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {languages.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground whitespace-nowrap">From:</label>
              <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-8 text-xs w-[140px]" />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground whitespace-nowrap">To:</label>
              <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-8 text-xs w-[140px]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Distribution Log</CardTitle>
          <CardDescription>Select leads with checkboxes to bulk-assign, or use the dropdown per row. Click a row for full details.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={paginatedLeads.length > 0 && paginatedLeads.every(l => selectedLeadIds.has(l.id))}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[90px]">Import Date</TableHead>
                  <TableHead className="w-[80px]">Batch</TableHead>
                  <TableHead>Lead / Username</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Assign Agent</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                      No leads match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map(lead => (
                    <TableRow key={lead.id} className="hover:bg-accent/50 transition-colors">
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLeadIds.has(lead.id)}
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground cursor-pointer" onClick={() => setSelectedLead(lead)}>{formatDate(lead.import_date)}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground cursor-pointer" onClick={() => setSelectedLead(lead)}>{shortBatchId(lead.import_batch_id)}</TableCell>
                      <TableCell className="text-xs font-medium cursor-pointer" onClick={() => setSelectedLead(lead)}>{lead.username}</TableCell>
                      <TableCell className="text-xs text-muted-foreground cursor-pointer" onClick={() => setSelectedLead(lead)}>{maskPhone(lead.phone_number)}</TableCell>
                      <TableCell className="text-xs cursor-pointer" onClick={() => setSelectedLead(lead)}>{lead.language}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Select
                          value={lead.assigned_agent_id || '_unassigned'}
                          onValueChange={(v) => {
                            if (v !== '_unassigned') assignLeadToAgent(lead.id, v);
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_unassigned" disabled>Unassigned</SelectItem>
                            {agents.map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">{lead.status.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Showing {((currentPage - 1) * ROWS_PER_PAGE) + 1}–{Math.min(currentPage * ROWS_PER_PAGE, totalCount)} of {totalCount} leads
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 w-8 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) { pageNum = i + 1; }
                  else if (currentPage <= 4) { pageNum = i + 1; }
                  else if (currentPage >= totalPages - 3) { pageNum = totalPages - 6 + i; }
                  else { pageNum = currentPage - 3 + i; }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 w-8 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.username || 'Lead Details'}
        subtitle="Imported Lead Detail"
        width="w-[520px]"
      >
        {selectedLead && (
          <div className="space-y-6">
            {/* Assignment Section */}
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assign to Agent</p>
              <Select
                value={selectedLead.assigned_agent_id || '_unassigned'}
                onValueChange={(v) => {
                  if (v !== '_unassigned') assignLeadToAgent(selectedLead.id, v);
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_unassigned" disabled>Unassigned</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name} — {a.languages.join(', ')} — {a.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <p className="text-xs text-muted-foreground">Current Agent</p>
                  <p className="text-sm font-semibold">
                    {selectedLead.agent_name || <span className="text-destructive">Unassigned</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assignment Status</p>
                  {selectedLead.assigned_agent_id ? (
                    <Badge className="text-xs bg-primary/15 text-primary border-0">Distributed</Badge>
                  ) : (
                    <Badge className="text-xs bg-destructive/15 text-destructive border-0">Pending</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Lead Info */}
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="text-sm font-medium">{selectedLead.username}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm">{maskPhone(selectedLead.phone_number)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm">{selectedLead.email || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">State</p>
                  <p className="text-sm">{selectedLead.state}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Language</p>
                  <p className="text-sm">{selectedLead.language}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Temperature</p>
                  <Badge variant="outline" className="text-xs capitalize">{selectedLead.temperature}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="text-sm">{selectedLead.score}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Potential Commission</p>
                  <p className="text-sm">₹{selectedLead.potential_commission}</p>
                </div>
              </div>
            </div>

            {/* Import Info */}
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Import Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Batch ID</p>
                  <p className="text-sm font-mono">{shortBatchId(selectedLead.import_batch_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Import Date</p>
                  <p className="text-sm">{formatDate(selectedLead.import_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Imported At</p>
                  <p className="text-sm">{formatDateTime(selectedLead.import_timestamp)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Imported By</p>
                  <p className="text-sm">{selectedLead.importer_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-sm capitalize">{selectedLead.source.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Campaign</p>
                  <p className="text-sm">{selectedLead.campaign_id || '—'}</p>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Timestamps</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">{formatDateTime(selectedLead.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="text-sm">{formatDateTime(selectedLead.updated_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Signup</p>
                  <p className="text-sm">{formatDateTime(selectedLead.signup_at)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}