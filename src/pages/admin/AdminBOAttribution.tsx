import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, RefreshCw, CheckCircle, XCircle, Clock, Link2, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BOMapping {
  id: string;
  lead_id: string;
  agent_id: string;
  agent_name: string;
  bo_user_id: string;
  sync_status: string;
  synced_at: string | null;
  retry_count: number;
  last_error: string | null;
  bo_response: Record<string, unknown> | null;
  previous_agent_name: string | null;
  mapping_reason: string;
  created_at: string;
  lead_username?: string;
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  synced: { label: 'Synced', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
  pending: { label: 'Pending', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
};

export default function AdminBOAttribution() {
  const [records, setRecords] = useState<BOMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);

    const { data: mappings, error } = await supabase
      .from('bo_agent_mappings' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error || !mappings) {
      console.error('Failed to fetch BO mappings:', error);
      setRecords([]);
      setIsLoading(false);
      return;
    }

    // Fetch lead usernames for display
    const leadIds = [...new Set((mappings as any[]).map((m: any) => m.lead_id).filter(Boolean))];
    const leadMap: Record<string, string> = {};
    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, username')
        .in('id', leadIds.slice(0, 200));
      (leads || []).forEach((l: any) => { leadMap[l.id] = l.username; });
    }

    const mapped: BOMapping[] = (mappings as any[]).map((m: any) => ({
      ...m,
      lead_username: leadMap[m.lead_id] || m.bo_user_id,
    }));

    setRecords(mapped);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const retrySync = async (mapping: BOMapping) => {
    setRetrying(mapping.id);
    try {
      const { error } = await supabase.functions.invoke('sync-calling-agent', {
        body: { leadId: mapping.lead_id, reason: 'admin_retry' },
      });
      if (error) {
        toast.error('Retry failed: ' + error.message);
      } else {
        toast.success('BO sync retried successfully');
        await fetchRecords();
      }
    } catch (err) {
      toast.error('Retry failed');
    } finally {
      setRetrying(null);
    }
  };

  const filtered = records.filter(r => {
    if (statusFilter !== 'all' && r.sync_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.agent_name.toLowerCase().includes(q) ||
        r.bo_user_id.toLowerCase().includes(q) ||
        (r.lead_username || '').toLowerCase().includes(q) ||
        r.lead_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalMappings = records.length;
  const syncedCount = records.filter(r => r.sync_status === 'synced').length;
  const failedCount = records.filter(r => r.sync_status === 'failed').length;
  const pendingCount = records.filter(r => r.sync_status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">BO Agent Attribution</h1>
          <p className="text-sm text-muted-foreground mt-1">Track Back Office agent-lead mapping sync status and FTD attribution</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRecords}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Mappings', value: totalMappings, icon: Link2, accent: 'text-info' },
          { label: 'Synced', value: syncedCount, icon: CheckCircle, accent: 'text-success' },
          { label: 'Failed', value: failedCount, icon: XCircle, accent: 'text-destructive' },
          { label: 'Pending', value: pendingCount, icon: Clock, accent: 'text-warning' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg border bg-card p-4 flex items-center gap-3">
            <div className={cn('flex items-center justify-center h-10 w-10 rounded-full bg-muted', kpi.accent)}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by agent, userId, lead..."
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="synced">Synced</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Link2 className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No BO mappings found</p>
            <p className="text-xs mt-1">Mappings are created when agents complete call dispositions</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-[160px]">Date</TableHead>
                <TableHead>BO User ID</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Previous Agent</TableHead>
                <TableHead>Error / Response</TableHead>
                <TableHead className="w-[80px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(rec => {
                const cfg = statusConfig[rec.sync_status] || statusConfig.pending;
                const StatusIcon = cfg.icon;
                return (
                  <TableRow key={rec.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {formatDateTime(rec.created_at)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-mono">{rec.bo_user_id}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={rec.lead_id}>
                        Lead: {rec.lead_id.slice(0, 8)}...
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{rec.agent_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={rec.agent_id}>
                        {rec.agent_id.slice(0, 8)}...
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-[10px] gap-1', cfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                      {rec.retry_count > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Retries: {rec.retry_count}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {rec.mapping_reason.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rec.previous_agent_name ? (
                        <p className="text-xs text-muted-foreground">{rec.previous_agent_name}</p>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rec.last_error ? (
                        <p className="text-xs text-destructive truncate max-w-[200px]" title={rec.last_error}>
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          {rec.last_error}
                        </p>
                      ) : rec.synced_at ? (
                        <p className="text-[10px] text-muted-foreground">
                          Synced {formatDateTime(rec.synced_at)}
                        </p>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {rec.sync_status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={retrying === rec.id}
                          onClick={() => retrySync(rec)}
                          title="Retry sync"
                        >
                          <RotateCcw className={cn('h-3.5 w-3.5', retrying === rec.id && 'animate-spin')} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {records.length} mappings
        </p>
      )}
    </div>
  );
}
