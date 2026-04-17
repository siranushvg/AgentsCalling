import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'weekoff';

function calcStatus(hours: number): AttendanceStatus {
  if (hours >= 7.5) return 'present';
  if (hours >= 4) return 'half_day';
  return 'absent';
}

function statusLabel(s: AttendanceStatus) {
  switch (s) {
    case 'present': return 'Present';
    case 'half_day': return 'Half Day';
    case 'absent': return 'Absent';
    case 'weekoff': return 'Week Off';
  }
}

function statusColor(s: AttendanceStatus) {
  switch (s) {
    case 'present': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'half_day': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'absent': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'weekoff': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  }
}

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export default function AgentAttendance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [requestModal, setRequestModal] = useState<{ date: string; currentStatus: AttendanceStatus } | null>(null);
  const [requestedStatus, setRequestedStatus] = useState<AttendanceStatus>('present');
  const [requestReason, setRequestReason] = useState('');

  const [year, monthNum] = selectedMonth.split('-').map(Number);
  const daysInMonth = useMemo(() => getDaysInMonth(year, monthNum), [year, monthNum]);

  // Get agent record
  const { data: agent } = useQuery({
    queryKey: ['my-agent-record'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, full_name').eq('user_id', user?.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Fetch sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ['my-attendance-sessions', selectedMonth, agent?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_sessions')
        .select('shift_date, active_minutes')
        .eq('agent_id', agent!.id)
        .gte('shift_date', daysInMonth[0])
        .lte('shift_date', daysInMonth[daysInMonth.length - 1]);
      return data || [];
    },
    enabled: !!agent,
  });

  // Fetch shifts (weekoffs)
  const { data: shifts = [] } = useQuery({
    queryKey: ['my-attendance-shifts', selectedMonth, agent?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_shifts')
        .select('date, is_off_day')
        .eq('agent_id', agent!.id)
        .gte('date', daysInMonth[0])
        .lte('date', daysInMonth[daysInMonth.length - 1])
        .eq('is_off_day', true);
      return data || [];
    },
    enabled: !!agent,
  });

  // Fetch overrides (approved by admin)
  const { data: overrides = [] } = useQuery({
    queryKey: ['my-attendance-overrides', selectedMonth, agent?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_overrides')
        .select('date, override_status, override_reason')
        .eq('agent_id', agent!.id)
        .gte('date', daysInMonth[0])
        .lte('date', daysInMonth[daysInMonth.length - 1]);
      return data || [];
    },
    enabled: !!agent,
  });

  // Fetch my requests
  const { data: myRequests = [] } = useQuery({
    queryKey: ['my-attendance-requests', selectedMonth, agent?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_requests')
        .select('*')
        .eq('agent_id', agent!.id)
        .gte('date', daysInMonth[0])
        .lte('date', daysInMonth[daysInMonth.length - 1])
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!agent,
  });

  // Build day records
  const { dayRecords, presentDays, halfDays, absentDays, weekoffDays, payableDays, totalLoginHours } = useMemo(() => {
    let present = 0, half = 0, absent = 0, weekoff = 0, totalHrs = 0;
    const records = daysInMonth.map(date => {
      const daySessions = sessions.filter(s => s.shift_date === date);
      const loginHours = daySessions.reduce((sum, s) => sum + (s.active_minutes || 0), 0) / 60;
      totalHrs += loginHours;
      const isWeekoff = shifts.some(s => s.date === date && s.is_off_day);
      const override = overrides.find(o => o.date === date);
      let status: AttendanceStatus = isWeekoff ? 'weekoff' : calcStatus(loginHours);
      const finalStatus = override ? (override.override_status as AttendanceStatus) : status;
      switch (finalStatus) {
        case 'present': present++; break;
        case 'half_day': half++; break;
        case 'absent': absent++; break;
        case 'weekoff': weekoff++; break;
      }
      const request = myRequests.find(r => r.date === date);
      return { date, loginHours, status, finalStatus, overrideReason: override?.override_reason, request };
    });
    return {
      dayRecords: records,
      presentDays: present,
      halfDays: half,
      absentDays: absent,
      weekoffDays: weekoff,
      payableDays: present + (half * 0.5) + weekoff,
      totalLoginHours: totalHrs,
    };
  }, [daysInMonth, sessions, shifts, overrides, myRequests]);

  // Submit request
  const submitRequest = useMutation({
    mutationFn: async (params: { date: string; currentStatus: AttendanceStatus; requestedStatus: AttendanceStatus; reason: string }) => {
      const { error } = await supabase.from('attendance_requests').insert({
        agent_id: agent!.id,
        date: params.date,
        current_status: params.currentStatus,
        requested_status: params.requestedStatus,
        reason: params.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-attendance-requests'] });
      toast.success('Change request submitted');
      setRequestModal(null);
      setRequestReason('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      opts.push({ value: val, label });
    }
    return opts;
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">My Attendance</h2>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="h-9 text-xs w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Present', value: presentDays, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
          { label: 'Half Day', value: halfDays, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
          { label: 'Absent', value: absentDays, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
          { label: 'Week Off', value: weekoffDays, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
          { label: 'Payable Days', value: payableDays, color: 'bg-primary/10 text-primary' },
          { label: 'Login Hours', value: `${totalLoginHours.toFixed(1)}h`, color: 'bg-muted text-foreground' },
        ].map(card => (
          <div key={card.label} className="rounded-lg border bg-card p-3 text-center shadow-sm">
            <div className={`text-2xl font-bold ${card.color.split(' ').slice(1).join(' ')}`}>{card.value}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Daily table */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold text-sm">Daily Attendance — {monthOptions.find(m => m.value === selectedMonth)?.label}</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">P ≥ 7.5h | HD 4–7.29h | A &lt;4h | WO = Week Off</p>
        </div>
        <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Day</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Login Hours</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Request</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {dayRecords.map(day => {
                const dayDate = new Date(day.date + 'T00:00:00');
                const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                const isFuture = dayDate > now;
                const pendingRequest = day.request;

                return (
                  <tr key={day.date} className={`border-b hover:bg-accent/30 ${isFuture ? 'opacity-40' : ''}`}>
                    <td className="px-3 py-2">{dayDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                    <td className="px-3 py-2">{dayName}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{day.loginHours.toFixed(1)}h</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(day.finalStatus)}`}>
                        {statusLabel(day.finalStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {pendingRequest ? (
                        <Badge
                          variant={pendingRequest.status === 'approved' ? 'default' : pendingRequest.status === 'rejected' ? 'destructive' : 'secondary'}
                          className="text-[10px] gap-1"
                        >
                          {pendingRequest.status === 'pending' && <Clock className="h-2.5 w-2.5" />}
                          {pendingRequest.status === 'approved' && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {pendingRequest.status === 'rejected' && <XCircle className="h-2.5 w-2.5" />}
                          {pendingRequest.status === 'pending' ? 'Pending' : pendingRequest.status === 'approved' ? 'Approved' : 'Rejected'}
                          → {statusLabel(pendingRequest.requested_status as AttendanceStatus)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {!isFuture && (!pendingRequest || pendingRequest.status === 'rejected') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 gap-1"
                          onClick={() => {
                            setRequestModal({ date: day.date, currentStatus: day.finalStatus });
                            setRequestedStatus(day.finalStatus === 'absent' ? 'present' : 'present');
                            setRequestReason('');
                          }}
                        >
                          <Send className="h-2.5 w-2.5" />
                          Request Change
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Modal */}
      <Dialog open={!!requestModal} onOpenChange={() => setRequestModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Request Attendance Change</DialogTitle>
          </DialogHeader>
          {requestModal && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                Date: <strong>{new Date(requestModal.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
              </div>
              <div className="text-xs">
                Current: <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${statusColor(requestModal.currentStatus)}`}>{statusLabel(requestModal.currentStatus)}</span>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Change to</label>
                <Select value={requestedStatus} onValueChange={v => setRequestedStatus(v as AttendanceStatus)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="weekoff">Week Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Reason</label>
                <Textarea
                  value={requestReason}
                  onChange={e => setRequestReason(e.target.value)}
                  placeholder="Reason for requesting this change..."
                  className="text-xs h-20"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setRequestModal(null)}>Cancel</Button>
            <Button
              size="sm"
              disabled={submitRequest.isPending || !requestReason.trim()}
              onClick={() => {
                if (!requestModal) return;
                submitRequest.mutate({
                  date: requestModal.date,
                  currentStatus: requestModal.currentStatus,
                  requestedStatus,
                  reason: requestReason,
                });
              }}
            >
              {submitRequest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
