import React, { useState } from 'react';
import { useInboundCallLog, type InboundCallRecord } from '@/hooks/useInboundCallLog';
import { useScheduledCallbacks } from '@/hooks/useScheduledCallbacks';
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
  PhoneIncoming, Play, Pause, Search, Star, RefreshCw, Clock,
  CheckCircle, XCircle, PhoneMissed, Filter, FileText,
} from 'lucide-react';
import { maskPhone } from '@/lib/maskPhone';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formatDuration = (s: number) => {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
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
  interested: 'Interested',
  converted: 'Converted',
  callback: 'Callback',
  not_interested: 'Not Interested',
  no_answer: 'No Answer',
  follow_up: 'Follow Up',
  wrong_number: 'Wrong Number',
  busy: 'Busy',
  support_needed: 'Support Needed',
};

export default function IncomingCallsMode() {
  const { calls, isLoading, refetch } = useInboundCallLog();
  const { addCallback } = useScheduledCallbacks();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioRef] = useState(() => new Audio());

  const filtered = calls.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.lead_username.toLowerCase().includes(q) ||
        c.lead_phone.includes(q) ||
        (c.disposition || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalCalls = calls.length;
  const completedCalls = calls.filter(c => c.status === 'completed').length;
  const missedCalls = calls.filter(c => c.status === 'missed').length;
  const withDisposition = calls.filter(c => c.disposition).length;
  const withRecording = calls.filter(c => c.recording_url).length;

  const togglePlay = (call: InboundCallRecord) => {
    if (!call.recording_url) return;
    if (playingId === call.id) {
      audioRef.pause();
      setPlayingId(null);
    } else {
      audioRef.src = call.recording_url;
      audioRef.play();
      setPlayingId(call.id);
      audioRef.onended = () => setPlayingId(null);
    }
  };

  const handleAddToPriority = async (call: InboundCallRecord) => {
    if (!call.lead_id) {
      toast.error('Cannot schedule callback for unknown caller');
      return;
    }
    try {
      await addCallback({
        leadId: call.lead_id,
        leadName: call.lead_username,
        disposition: 'callback',
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
        reason: 'Follow-up from incoming call',
        status: 'pending',
      });
      toast.success('Added to Priority Queue');
    } catch {
      toast.error('Failed to add to Priority Queue');
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Inbound', value: totalCalls, icon: PhoneIncoming, accent: 'text-info' },
          { label: 'Completed', value: completedCalls, icon: CheckCircle, accent: 'text-success' },
          { label: 'Missed', value: missedCalls, icon: PhoneMissed, accent: 'text-destructive' },
          { label: 'With Disposition', value: withDisposition, icon: FileText, accent: 'text-primary' },
          { label: 'Recordings', value: withRecording, icon: Play, accent: 'text-warning' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg border bg-card p-3 flex items-center gap-3">
            <div className={cn('flex items-center justify-center h-9 w-9 rounded-full bg-muted', kpi.accent)}>
              <kpi.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, disposition..."
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="ringing">Ringing</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <PhoneIncoming className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No incoming calls found</p>
            <p className="text-xs mt-1">Incoming calls will appear here in real-time</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-[160px]">Time</TableHead>
                <TableHead>Caller</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[90px]">Duration</TableHead>
                <TableHead className="w-[130px]">Disposition</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(call => {
                const cfg = statusConfig[call.status] || statusConfig.failed;
                const StatusIcon = cfg.icon;
                return (
                  <TableRow key={call.id} className="group">
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {formatDateTime(call.started_at)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{call.lead_username}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {call.lead_phone ? maskPhone(call.lead_phone) : '—'}
                        </p>
                        {call.lead_language && (
                          <span className="text-[10px] text-muted-foreground">
                            {call.lead_language}{call.lead_state ? ` · ${call.lead_state}` : ''}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-[10px] gap-1', cfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '—'}
                    </TableCell>
                    <TableCell>
                      {call.disposition ? (
                        <Badge variant="outline" className="text-[10px]">
                          {dispositionLabels[call.disposition] || call.disposition}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {call.notes || '—'}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                        {call.recording_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => togglePlay(call)}
                            title={playingId === call.id ? 'Pause' : 'Play recording'}
                          >
                            {playingId === call.id ? (
                              <Pause className="h-3.5 w-3.5 text-warning" />
                            ) : (
                              <Play className="h-3.5 w-3.5 text-success" />
                            )}
                          </Button>
                        )}
                        {call.lead_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleAddToPriority(call)}
                            title="Add to Priority Queue"
                          >
                            <Star className="h-3.5 w-3.5 text-warning" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
