import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const PAGE_SIZE = 100;

interface LeadEntry {
  id: string;
  username: string;
  phone_last5: string;
  status: string;
  language: string;
  state: string;
  import_batch_id: string | null;
  assigned_agent_name: string | null;
  created_at: string;
  updated_at: string;
}

interface BatchInfo {
  id: string;
  label: string;
  count: number;
}

function mapLead(l: any): LeadEntry {
  return {
    id: l.id,
    username: l.username,
    phone_last5: (l.phone_number || '').replace(/\D/g, '').slice(-5),
    status: l.status,
    language: l.language,
    state: l.state,
    import_batch_id: l.import_batch_id,
    assigned_agent_name: l.agents?.full_name || null,
    created_at: l.created_at,
    updated_at: l.updated_at,
  };
}

export default function AdminLeadLookup() {
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);

  // Reset page when filters change
  const applySearch = useCallback(() => {
    setActiveSearch(search);
    setPage(0);
  }, [search]);

  const handleBatchChange = useCallback((v: string) => {
    setBatchFilter(v);
    setPage(0);
  }, []);

  const handleStatusChange = useCallback((v: string) => {
    setStatusFilter(v);
    setPage(0);
  }, []);

  // Fetch batch options from csv_imports (no lead-side limit needed)
  const { data: batches = [] } = useQuery<BatchInfo[]>({
    queryKey: ['admin-lead-batches-v3'],
    queryFn: async () => {
      const { data: imports } = await supabase
        .from('csv_imports')
        .select('import_batch_id, file_name, created_at, imported_count')
        .not('import_batch_id', 'is', null)
        .order('created_at', { ascending: false });

      return (imports || [])
        .filter((ci: any) => ci.import_batch_id)
        .map((ci: any) => ({
          id: ci.import_batch_id,
          label: `${ci.file_name} (${format(new Date(ci.created_at), 'dd MMM')})`,
          count: ci.imported_count || 0,
        }));
    },
  });

  // Total count query (for pagination)
  const { data: totalCount = 0 } = useQuery({
    queryKey: ['admin-lead-count-v3', activeSearch, batchFilter, statusFilter],
    queryFn: async () => {
      const q = activeSearch.trim().toLowerCase();

      let query = supabase
        .from('leads')
        .select('id', { count: 'exact', head: true });

      if (batchFilter !== 'all') query = query.eq('import_batch_id', batchFilter);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter as any);

      if (q) {
        query = query.ilike('username', `%${q}%`);
      }

      const { count } = await query;
      return count || 0;
    },
  });

  // Main paginated data query
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['admin-lead-lookup-v3', activeSearch, batchFilter, statusFilter, page],
    queryFn: async () => {
      const q = activeSearch.trim().toLowerCase();
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      if (q) {
        // Server-side search across all leads (no cap)
        const results: any[] = [];
        const seenIds = new Set<string>();

        const addResults = (data: any[] | null) => {
          (data || []).forEach(r => {
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              results.push(r);
            }
          });
        };

        const selectCols = 'id, username, phone_number, status, language, state, import_batch_id, created_at, updated_at, agents:assigned_agent_id(full_name)';

        // 1. Search by username (paginated)
        let q1 = supabase
          .from('leads')
          .select(selectCols)
          .ilike('username', `%${q}%`)
          .order('updated_at', { ascending: false })
          .range(from, to);
        if (batchFilter !== 'all') q1 = q1.eq('import_batch_id', batchFilter);
        if (statusFilter !== 'all') q1 = q1.eq('status', statusFilter as any);
        const { data: d1 } = await q1;
        addResults(d1);

        // 2. Search by phone suffix (only on page 0 to supplement, no double-paging)
        if (/\d/.test(q) && page === 0) {
          let q2 = supabase
            .from('leads')
            .select(selectCols)
            .ilike('phone_number', `%${q}`)
            .order('updated_at', { ascending: false })
            .limit(PAGE_SIZE);
          if (batchFilter !== 'all') q2 = q2.eq('import_batch_id', batchFilter);
          if (statusFilter !== 'all') q2 = q2.eq('status', statusFilter as any);
          const { data: d2 } = await q2;
          addResults(d2);
        }

        // 3. Search by ID prefix (only on page 0)
        if (q.length >= 6 && /^[0-9a-f-]+$/.test(q) && page === 0) {
          let q3 = supabase
            .from('leads')
            .select(selectCols)
            .ilike('id', `${q}%`)
            .limit(50);
          if (batchFilter !== 'all') q3 = q3.eq('import_batch_id', batchFilter);
          if (statusFilter !== 'all') q3 = q3.eq('status', statusFilter as any);
          const { data: d3 } = await q3;
          addResults(d3);
        }

        return results.map(mapLead);
      }

      const selectCols = 'id, username, phone_number, status, language, state, import_batch_id, created_at, updated_at, agents:assigned_agent_id(full_name)';

      let query = supabase
        .from('leads')
        .select(selectCols)
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (batchFilter !== 'all') query = query.eq('import_batch_id', batchFilter);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter as any);

      const { data } = await query;
      return (data || []).map(mapLead);
    },
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applySearch();
  }, [applySearch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lead Lookup</h1>
        <p className="text-sm text-muted-foreground">
          Search any lead by username, phone (last digits), or Lead ID. Covers the full deployed dataset with server-side pagination.
        </p>
      </div>

      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Search</label>
              <div className="relative flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Username, last 5 digits, Lead ID"
                    className="pl-9 w-72 h-9"
                  />
                </div>
                <Button size="sm" onClick={applySearch} className="h-9">Search</Button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Upload File</label>
              <Select value={batchFilter} onValueChange={handleBatchChange}>
                <SelectTrigger className="w-64 h-9">
                  <SelectValue placeholder="All uploads" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All uploads</SelectItem>
                  {batches.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3" /> {b.label} ({b.count})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Status</label>
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="callback">Callback</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {isLoading ? 'Searching…' : `${totalCount.toLocaleString()} total leads`}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead ID</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Phone (Last 5)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      {isLoading ? 'Loading…' : 'No leads found. Try a different search or adjust filters.'}
                    </TableCell>
                  </TableRow>
                ) : leads.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-[11px] font-mono text-muted-foreground max-w-[100px] truncate" title={l.id}>
                      {l.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-sm font-medium">{l.username}</TableCell>
                    <TableCell className="text-xs font-mono">•••••{l.phone_last5}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{l.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.assigned_agent_name || <span className="text-muted-foreground italic">Unassigned</span>}
                    </TableCell>
                    <TableCell className="text-xs">{l.language}</TableCell>
                    <TableCell className="text-xs">{l.state}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(l.updated_at), 'dd MMM yyyy HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} · Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="h-8"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="h-8"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}