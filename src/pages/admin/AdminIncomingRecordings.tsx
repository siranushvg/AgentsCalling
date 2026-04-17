import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  PhoneIncoming, Play, Pause, Search, RefreshCw, CheckCircle,
  XCircle, PhoneMissed, Filter, FileText, Download, Clock,
} from 'lucide-react';
import { maskPhone } from '@/lib/maskPhone';
import { cn } from '@/lib/utils';

interface InboundRecording {
  id: string;
  lead_id: string | null;
  lead_username: string;
  caller_number: string;
  agent_id: string;
  agent_name: string;
  status: string;
  disposition: string | null;
  duration_seconds: number;
  recording_url: string | null;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

const formatDuration = (s: number) => {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  completed: { label: 'Completed', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
  missed: { label: 'Missed', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: PhoneMissed },
  failed: { label: 'Failed', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
  ringing: { label: 'Ringing', color: 'bg-warning/10 text-warning border-warning/20', icon: PhoneIncoming },
  connected: { label: 'On Call', color: 'bg-info/10 text-info border-info/20', icon: PhoneIncoming },
};

const dispositionLabels: Record<string, string> = {
  interested: 'Interested', converted: 'Converted', callback: 'Callback',
  not_interested: 'Not Interested', no_answer: 'No Answer', follow_up: 'Follow Up',
  wrong_number: 'Wrong Number', busy: 'Busy', support_needed: 'Support Needed',
};

export default function AdminIncomingRecordings() {
  const [records, setRecords] = useState<InboundRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dispositionFilter, setDispositionFilter] = useState('all');
  const [recordingFilter, setRecordingFilter] = useState('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef(new Audio());

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);

    // Query dedicated inbound call recordings view
    const { data, error } = await supabase
      .from('inbound_call_recordings' as any)
      .select('*')
      .order('started_at', { ascending: false })
      .limit(500);

    if (error || !data) {
      console.error('Failed to fetch inbound recordings:', error);
      setRecords([]);
      setIsLoading(false);
      return;
    }

    const mapped: InboundRecording[] = (data as any[]).map((r: any) => ({
      id: r.id,
      lead_id: r.lead_id,
      lead_username: r.lead_username || (r.caller_number ? `Unknown (${String(r.caller_number).slice(-4)})` : 'Unknown'),
      caller_number: r.caller_number || '',
      agent_id: r.agent_id,
      agent_name: r.agent_name || 'Unknown',
      status: r.status,
      disposition: r.disposition,
      duration_seconds: r.duration_seconds,
      recording_url: r.recording_url,
      started_at: r.started_at,
      ended_at: r.ended_at,
      notes: r.notes,
    }));

    setRecords(mapped);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Cleanup audio on unmount
  useEffect(() => {
    const audio = audioRef.current;
    return () => { audio.pause(); audio.src = ''; };
  }, []);

  const filtered = records.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (dispositionFilter !== 'all' && (r.disposition || '') !== dispositionFilter) return false;
    if (recordingFilter === 'has_recording' && !r.recording_url) return false;
    if (recordingFilter === 'no_recording' && r.recording_url) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.lead_username.toLowerCase().includes(q) ||
        r.caller_number.includes(q) ||
        r.agent_name.toLowerCase().includes(q) ||
        (r.lead_id || '').toLowerCase().includes(q) ||
        (r.disposition || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalInbound = records.length;
  const withRecording = records.filter(r => r.recording_url).length;
  const completedCalls = records.filter(r => r.status === 'completed').length;
  const missedCalls = records.filter(r => r.status === 'missed').length;

  const togglePlay = (rec: InboundRecording) => {
    if (!rec.recording_url) return;
    const audio = audioRef.current;
    if (playingId === rec.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.src = rec.recording_url;
      audio.play();
      setPlayingId(rec.id);
      audio.onended = () => setPlayingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Incoming Call Recordings</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and listen to inbound call recordings across all agents</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRecords}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Inbound', value: totalInbound, icon: PhoneIncoming, accent: 'text-info' },
          { label: 'With Recording', value: withRecording, icon: Play, accent: 'text-warning' },
          { label: 'Completed', value: completedCalls, icon: CheckCircle, accent: 'text-success' },
          { label: 'Missed', value: missedCalls, icon: PhoneMissed, accent: 'text-destructive' },
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
            placeholder="Search by name, phone, agent, lead ID..."
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dispositionFilter} onValueChange={setDispositionFilter}>
          <SelectTrigger className="w-40 h-9">
            <FileText className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dispositions</SelectItem>
            {Object.entries(dispositionLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={recordingFilter} onValueChange={setRecordingFilter}>
          <SelectTrigger className="w-40 h-9">
            <Play className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Calls</SelectItem>
            <SelectItem value="has_recording">With Recording</SelectItem>
            <SelectItem value="no_recording">No Recording</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <PhoneIncoming className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No incoming call recordings found</p>
            <p className="text-xs mt-1">Adjust your filters or check back later</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-[170px]">Date / Time</TableHead>
                <TableHead>Caller</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[80px]">Duration</TableHead>
                <TableHead className="w-[130px]">Disposition</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[100px] text-center">Recording</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(rec => {
                const cfg = statusConfig[rec.status] || statusConfig.failed;
                const StatusIcon = cfg.icon;
                const isPlaying = playingId === rec.id;
                return (
                  <TableRow key={rec.id} className="group">
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {formatDateTime(rec.started_at)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{rec.lead_username}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {rec.caller_number ? maskPhone(rec.caller_number) : '—'}
                        </p>
                        {rec.lead_id && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={rec.lead_id}>
                            ID: {rec.lead_id.slice(0, 8)}...
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{rec.agent_name}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-[10px] gap-1', cfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {rec.duration_seconds > 0 ? formatDuration(rec.duration_seconds) : '—'}
                    </TableCell>
                    <TableCell>
                      {rec.disposition ? (
                        <Badge variant="outline" className="text-[10px]">
                          {dispositionLabels[rec.disposition] || rec.disposition}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]" title={rec.notes || ''}>
                        {rec.notes || '—'}
                      </p>
                    </TableCell>
                    <TableCell className="text-center">
                      {rec.recording_url ? (
                        <div className="flex items-center gap-1 justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => togglePlay(rec)}
                            title={isPlaying ? 'Pause' : 'Play recording'}
                          >
                            {isPlaying ? (
                              <Pause className="h-3.5 w-3.5 text-warning" />
                            ) : (
                              <Play className="h-3.5 w-3.5 text-success" />
                            )}
                          </Button>
                          <a href={rec.recording_url} target="_blank" rel="noopener noreferrer" title="Download">
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Download className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </a>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
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
          Showing {filtered.length} of {records.length} inbound calls
        </p>
      )}
    </div>
  );
}