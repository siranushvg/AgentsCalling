import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Download, Edit2, Check, X, Bell, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { exportToCSV } from '@/lib/exportCSV';
import { toast } from 'sonner';

type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'weekoff';

interface DayRecord {
  date: string;
  loginHours: number;
  status: AttendanceStatus;
  overrideStatus?: AttendanceStatus;
  overrideReason?: string;
  isWeekoff: boolean;
}

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

export default function AttendancePayrollReport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [agentFilter, setAgentFilter] = useState('all');
  const [overrideModal, setOverrideModal] = useState<{
    agentId: string;
    agentName: string;
    date: string;
    currentStatus: AttendanceStatus;
    originalStatus: AttendanceStatus;
  } | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<AttendanceStatus>('present');
  const [overrideReason, setOverrideReason] = useState('');

  // Salary override modal
  const [salaryOverrideModal, setSalaryOverrideModal] = useState<{
    agentId: string;
    agentName: string;
    field: string;
    currentValue: number;
  } | null>(null);
  const [salaryOverrideValue, setSalaryOverrideValue] = useState('');
  const [showRequests, setShowRequests] = useState(false);
  const [reviewModal, setReviewModal] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');

  const [year, monthNum] = selectedMonth.split('-').map(Number);
  const daysInMonth = useMemo(() => getDaysInMonth(year, monthNum), [year, monthNum]);

  // Fetch agents
  const { data: agents = [] } = useQuery({
    queryKey: ['attendance-agents'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, full_name, monthly_salary, status').order('full_name');
      return data || [];
    },
  });

  const activeAgents = useMemo(() => agents.filter(a => a.status === 'active' || a.status === 'training'), [agents]);

  // Fetch sessions for the month
  const { data: sessions = [] } = useQuery({
    queryKey: ['attendance-sessions', selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_sessions')
        .select('agent_id, shift_date, active_minutes, login_at, logout_at')
        .gte('shift_date', daysInMonth[0])
        .lte('shift_date', daysInMonth[daysInMonth.length - 1]);
      return data || [];
    },
  });

  // Fetch agent_shifts (weekoffs)
  const { data: shifts = [] } = useQuery({
    queryKey: ['attendance-shifts', selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_shifts')
        .select('agent_id, date, is_off_day')
        .gte('date', daysInMonth[0])
        .lte('date', daysInMonth[daysInMonth.length - 1])
        .eq('is_off_day', true);
      return data || [];
    },
  });

  // Fetch overrides
  const { data: overrides = [] } = useQuery({
    queryKey: ['attendance-overrides', selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_overrides')
        .select('*')
        .gte('date', daysInMonth[0])
        .lte('date', daysInMonth[daysInMonth.length - 1]);
      return data || [];
    },
  });

  // Fetch commissions for the month
  const { data: commissions = [] } = useQuery({
    queryKey: ['attendance-commissions', selectedMonth],
    queryFn: async () => {
      const startDate = `${selectedMonth}-01T00:00:00`;
      const endDate = new Date(year, monthNum, 0, 23, 59, 59).toISOString();
      const { data } = await supabase
        .from('commissions')
        .select('agent_id, amount, tier')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      return data || [];
    },
  });

  // Fetch attendance change requests
  const { data: attendanceRequests = [] } = useQuery({
    queryKey: ['admin-attendance-requests', selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_requests')
        .select('*')
        .gte('date', daysInMonth[0])
        .lte('date', daysInMonth[daysInMonth.length - 1])
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const pendingRequestsCount = attendanceRequests.filter(r => r.status === 'pending').length;

  // Review request mutation
  const reviewRequestMutation = useMutation({
    mutationFn: async (params: { requestId: string; status: 'approved' | 'rejected'; note: string; agentId: string; date: string; requestedStatus: string; currentStatus: string }) => {
      // Update request
      const { error } = await supabase
        .from('attendance_requests')
        .update({ status: params.status, reviewed_by: user?.id, reviewed_at: new Date().toISOString(), review_note: params.note })
        .eq('id', params.requestId);
      if (error) throw error;

      // If approved, also create/update the attendance override
      if (params.status === 'approved') {
        const { error: overrideError } = await supabase
          .from('attendance_overrides')
          .upsert({
            agent_id: params.agentId,
            date: params.date,
            original_status: params.currentStatus,
            override_status: params.requestedStatus,
            override_reason: `Agent request approved: ${params.note}`,
            overridden_by: user?.id || '',
          }, { onConflict: 'agent_id,date' });
        if (overrideError) throw overrideError;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-overrides'] });
      toast.success(`Request ${vars.status}`);
      setReviewModal(null);
      setReviewNote('');
    },
    onError: (e: any) => toast.error(e.message),
  });


  const attendanceData = useMemo(() => {
    const filteredAgents = agentFilter === 'all' ? activeAgents : activeAgents.filter(a => a.id === agentFilter);

    return filteredAgents.map(agent => {
      const agentSessions = sessions.filter(s => s.agent_id === agent.id);
      const agentShifts = shifts.filter(s => s.agent_id === agent.id);
      const agentOverrides = overrides.filter(o => o.agent_id === agent.id);

      let presentDays = 0;
      let halfDays = 0;
      let absentDays = 0;
      let weekoffDays = 0;
      let totalLoginHours = 0;

      const dayRecords: DayRecord[] = daysInMonth.map(date => {
        // Sum active_minutes for this date
        const daySessions = agentSessions.filter(s => s.shift_date === date);
        const totalMinutes = daySessions.reduce((sum, s) => sum + (s.active_minutes || 0), 0);
        const loginHours = totalMinutes / 60;
        totalLoginHours += loginHours;

        const isWeekoff = agentShifts.some(s => s.date === date && s.is_off_day);
        const override = agentOverrides.find(o => o.date === date);

        let status: AttendanceStatus;
        if (isWeekoff) {
          status = 'weekoff';
        } else {
          status = calcStatus(loginHours);
        }

        const finalStatus = override ? (override.override_status as AttendanceStatus) : status;

        // Count
        switch (finalStatus) {
          case 'present': presentDays++; break;
          case 'half_day': halfDays++; break;
          case 'absent': absentDays++; break;
          case 'weekoff': weekoffDays++; break;
        }

        return {
          date,
          loginHours,
          status,
          overrideStatus: override ? (override.override_status as AttendanceStatus) : undefined,
          overrideReason: override?.override_reason || undefined,
          isWeekoff,
        };
      });

      // Payable days: present + (half_day * 0.5) + weekoff
      const payableDays = presentDays + (halfDays * 0.5) + weekoffDays;
      const totalWorkingDays = daysInMonth.length - weekoffDays;
      const dailyRate = totalWorkingDays > 0 ? (agent.monthly_salary || 0) / totalWorkingDays : 0;
      const payableSalary = dailyRate * payableDays;

      // Commission breakdown
      const agentCommissions = commissions.filter(c => c.agent_id === agent.id);
      const directComm = agentCommissions.filter(c => c.tier === 'direct').reduce((s, c) => s + Number(c.amount), 0);
      const tier2Comm = agentCommissions.filter(c => c.tier === 'tier2').reduce((s, c) => s + Number(c.amount), 0);
      const tier3Comm = agentCommissions.filter(c => c.tier === 'tier3').reduce((s, c) => s + Number(c.amount), 0);
      const totalComm = directComm + tier2Comm + tier3Comm;

      const totalPayable = payableSalary + totalComm;

      return {
        agent,
        dayRecords,
        presentDays,
        halfDays,
        absentDays,
        weekoffDays,
        payableDays,
        totalWorkingDays,
        totalLoginHours,
        monthlySalary: agent.monthly_salary || 0,
        payableSalary: Math.round(payableSalary),
        directComm: Math.round(directComm),
        tier2Comm: Math.round(tier2Comm),
        tier3Comm: Math.round(tier3Comm),
        totalComm: Math.round(totalComm),
        totalPayable: Math.round(totalPayable),
      };
    });
  }, [activeAgents, sessions, shifts, overrides, commissions, daysInMonth, agentFilter]);

  // Save override
  const overrideMutation = useMutation({
    mutationFn: async (params: { agentId: string; date: string; originalStatus: AttendanceStatus; overrideStatus: AttendanceStatus; reason: string }) => {
      const { error } = await supabase
        .from('attendance_overrides')
        .upsert({
          agent_id: params.agentId,
          date: params.date,
          original_status: params.originalStatus,
          override_status: params.overrideStatus,
          override_reason: params.reason,
          overridden_by: user?.id || '',
        }, { onConflict: 'agent_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-overrides'] });
      toast.success('Attendance override saved');
      setOverrideModal(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleExport = () => {
    const rows = attendanceData.map(d => ({
      agent: d.agent.full_name,
      present_days: d.presentDays,
      half_days: d.halfDays,
      absent_days: d.absentDays,
      weekoff_days: d.weekoffDays,
      payable_days: d.payableDays,
      total_login_hours: d.totalLoginHours.toFixed(1),
      monthly_salary: d.monthlySalary,
      payable_salary: d.payableSalary,
      direct_commission: d.directComm,
      tier2_commission: d.tier2Comm,
      tier3_commission: d.tier3Comm,
      total_commission: d.totalComm,
      total_payable: d.totalPayable,
    }));
    exportToCSV(rows, `attendance-payroll-${selectedMonth}`);
  };

  // Generate month options (last 12 months)
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
      {/* Filters */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Month</label>
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
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Agent</label>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="h-9 text-xs w-[180px]">
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {activeAgents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" className="h-9 gap-1.5 ml-auto" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Table */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Attendance & Payroll Summary — {monthOptions.find(m => m.value === selectedMonth)?.label}</h3>
          <span className="text-xs text-muted-foreground">
            Legend: P ≥ 7.5h | HD 4–7.29h | A &lt;4h | WO = Week Off
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 min-w-[140px]">Agent</th>
                <th className="px-2 py-2 text-center font-medium text-muted-foreground">Present</th>
                <th className="px-2 py-2 text-center font-medium text-muted-foreground">Half Day</th>
                <th className="px-2 py-2 text-center font-medium text-muted-foreground">Absent</th>
                <th className="px-2 py-2 text-center font-medium text-muted-foreground">Week Off</th>
                <th className="px-2 py-2 text-center font-medium text-muted-foreground">Payable Days</th>
                <th className="px-2 py-2 text-center font-medium text-muted-foreground">Login Hrs</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Monthly Salary</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Payable Salary</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Direct Comm</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Tier 2</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Tier 3</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Total Comm</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground font-bold">Total Payable</th>
                <th className="px-2 py-2 text-center font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-muted-foreground text-sm">No agents found</td>
                </tr>
              ) : attendanceData.map(d => (
                <tr key={d.agent.id} className="border-b hover:bg-accent/30">
                  <td className="px-3 py-2.5 font-medium sticky left-0 bg-card z-10">{d.agent.full_name}</td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 font-semibold">{d.presentDays}</span>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 font-semibold">{d.halfDays}</span>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 font-semibold">{d.absentDays}</span>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 font-semibold">{d.weekoffDays}</span>
                  </td>
                  <td className="px-2 py-2.5 text-center font-semibold">{d.payableDays}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums">{d.totalLoginHours.toFixed(1)}h</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">₹{d.monthlySalary.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums font-medium">₹{d.payableSalary.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">₹{d.directComm.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">₹{d.tier2Comm.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">₹{d.tier3Comm.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">₹{d.totalComm.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums font-bold text-primary">₹{d.totalPayable.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      title="View daily breakdown & override"
                      onClick={() => setAgentFilter(d.agent.id)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            {attendanceData.length > 0 && (
              <tfoot>
                <tr className="bg-muted/30 font-semibold text-xs">
                  <td className="px-3 py-2.5 sticky left-0 bg-muted/30 z-10">Totals ({attendanceData.length} agents)</td>
                  <td className="px-2 py-2.5 text-center">{attendanceData.reduce((s, d) => s + d.presentDays, 0)}</td>
                  <td className="px-2 py-2.5 text-center">{attendanceData.reduce((s, d) => s + d.halfDays, 0)}</td>
                  <td className="px-2 py-2.5 text-center">{attendanceData.reduce((s, d) => s + d.absentDays, 0)}</td>
                  <td className="px-2 py-2.5 text-center">{attendanceData.reduce((s, d) => s + d.weekoffDays, 0)}</td>
                  <td className="px-2 py-2.5 text-center">{attendanceData.reduce((s, d) => s + d.payableDays, 0)}</td>
                  <td className="px-2 py-2.5 text-center">{attendanceData.reduce((s, d) => s + d.totalLoginHours, 0).toFixed(1)}h</td>
                  <td className="px-2 py-2.5 text-right">₹{attendanceData.reduce((s, d) => s + d.monthlySalary, 0).toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right">₹{attendanceData.reduce((s, d) => s + d.payableSalary, 0).toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right">₹{attendanceData.reduce((s, d) => s + d.directComm, 0).toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right">₹{attendanceData.reduce((s, d) => s + d.tier2Comm, 0).toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right">₹{attendanceData.reduce((s, d) => s + d.tier3Comm, 0).toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right">₹{attendanceData.reduce((s, d) => s + d.totalComm, 0).toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right text-primary">₹{attendanceData.reduce((s, d) => s + d.totalPayable, 0).toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Daily Breakdown — shown when single agent selected */}
      {agentFilter !== 'all' && attendanceData.length === 1 && (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-5 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Daily Breakdown — {attendanceData[0].agent.full_name}</h3>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAgentFilter('all')}>
              <X className="h-3 w-3 mr-1" /> Back to all
            </Button>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Day</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Login Hours</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Auto Status</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Final Status (Admin)</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Agent Request</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Override Reason</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData[0].dayRecords.map(day => {
                  const dayDate = new Date(day.date + 'T00:00:00');
                  const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                  const finalStatus = day.overrideStatus || day.status;
                  const isFuture = dayDate > now;
                  const agentRequest = attendanceRequests.find(r => r.agent_id === attendanceData[0].agent.id && r.date === day.date);

                  return (
                    <tr key={day.date} className={`border-b hover:bg-accent/30 ${isFuture ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-2">{new Date(day.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                      <td className="px-3 py-2">{dayName}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{day.loginHours.toFixed(1)}h</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(day.status)}`}>
                          {statusLabel(day.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {!isFuture ? (
                          <Select
                            value={finalStatus}
                            onValueChange={(newStatus) => {
                              if (newStatus === day.status) {
                                // Remove override if reverting to auto status
                                // For now just save as override matching original
                              }
                              overrideMutation.mutate({
                                agentId: attendanceData[0].agent.id,
                                date: day.date,
                                originalStatus: day.status,
                                overrideStatus: newStatus as AttendanceStatus,
                                reason: newStatus !== finalStatus ? `Admin manual change: ${statusLabel(day.status)} → ${statusLabel(newStatus as AttendanceStatus)}` : (day.overrideReason || ''),
                              });
                            }}
                          >
                            <SelectTrigger className={`h-6 text-[10px] w-[100px] font-semibold border-0 ${statusColor(finalStatus)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">Present</SelectItem>
                              <SelectItem value="half_day">Half Day</SelectItem>
                              <SelectItem value="absent">Absent</SelectItem>
                              <SelectItem value="weekoff">Week Off</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(finalStatus)}`}>
                            {statusLabel(finalStatus)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {agentRequest ? (
                          <Badge
                            variant={agentRequest.status === 'approved' ? 'default' : agentRequest.status === 'rejected' ? 'destructive' : 'secondary'}
                            className="text-[10px] gap-1 cursor-pointer"
                            onClick={() => {
                              if (agentRequest.status === 'pending') {
                                setReviewModal(agentRequest);
                                setReviewNote('');
                              }
                            }}
                          >
                            {agentRequest.status === 'pending' && <Clock className="h-2.5 w-2.5" />}
                            {agentRequest.status === 'approved' && <CheckCircle2 className="h-2.5 w-2.5" />}
                            {agentRequest.status === 'rejected' && <XCircle className="h-2.5 w-2.5" />}
                            {agentRequest.status === 'pending' ? 'Pending' : agentRequest.status === 'approved' ? 'Approved' : 'Rejected'}
                            → {statusLabel(agentRequest.requested_status as AttendanceStatus)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[150px] truncate">{day.overrideReason || '—'}</td>
                      <td className="px-3 py-2 text-center">
                        {!isFuture && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2"
                            onClick={() => {
                              setOverrideModal({
                                agentId: attendanceData[0].agent.id,
                                agentName: attendanceData[0].agent.full_name,
                                date: day.date,
                                currentStatus: finalStatus,
                                originalStatus: day.status,
                              });
                              setOverrideStatus(finalStatus);
                              setOverrideReason(day.overrideReason || '');
                            }}
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Reason
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
      )}

      {/* Override Modal */}
      <Dialog open={!!overrideModal} onOpenChange={() => setOverrideModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Override Attendance</DialogTitle>
          </DialogHeader>
          {overrideModal && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                <strong>{overrideModal.agentName}</strong> — {new Date(overrideModal.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div className="text-xs">
                Auto-calculated: <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${statusColor(overrideModal.originalStatus)}`}>{statusLabel(overrideModal.originalStatus)}</span>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Override to</label>
                <Select value={overrideStatus} onValueChange={v => setOverrideStatus(v as AttendanceStatus)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
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
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Reason for override..."
                  className="text-xs h-20"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setOverrideModal(null)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => {
                if (!overrideModal) return;
                overrideMutation.mutate({
                  agentId: overrideModal.agentId,
                  date: overrideModal.date,
                  originalStatus: overrideModal.originalStatus,
                  overrideStatus,
                  reason: overrideReason,
                });
              }}
              disabled={overrideMutation.isPending}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Attendance Change Requests */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3 flex items-center justify-between cursor-pointer" onClick={() => setShowRequests(!showRequests)}>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Attendance Change Requests</h3>
            {pendingRequestsCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1 animate-bounce">
                {pendingRequestsCount}
              </span>
            )}
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs">
            {showRequests ? 'Hide' : 'Show'} ({attendanceRequests.length})
          </Button>
        </div>
        {showRequests && (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Agent</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Current</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Requested</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Reason</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRequests.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No requests</td></tr>
                ) : attendanceRequests.map(req => {
                  const agentName = agents.find(a => a.id === req.agent_id)?.full_name || 'Unknown';
                  return (
                    <tr key={req.id} className="border-b hover:bg-accent/30">
                      <td className="px-3 py-2 font-medium">{agentName}</td>
                      <td className="px-3 py-2">{new Date(req.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(req.current_status as AttendanceStatus)}`}>
                          {statusLabel(req.current_status as AttendanceStatus)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(req.requested_status as AttendanceStatus)}`}>
                          {statusLabel(req.requested_status as AttendanceStatus)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{req.reason || '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}
                          className="text-[10px] gap-1"
                        >
                          {req.status === 'pending' && <Clock className="h-2.5 w-2.5" />}
                          {req.status === 'approved' && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {req.status === 'rejected' && <XCircle className="h-2.5 w-2.5" />}
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {req.status === 'pending' && (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-6 text-[10px] px-2"
                              onClick={() => { setReviewModal(req); setReviewNote(''); }}
                            >
                              Review
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Request Modal */}
      <Dialog open={!!reviewModal} onOpenChange={() => setReviewModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Review Attendance Request</DialogTitle>
          </DialogHeader>
          {reviewModal && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                <strong>{agents.find(a => a.id === reviewModal.agent_id)?.full_name}</strong> — {new Date(reviewModal.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div className="text-xs space-y-1">
                <div>Current: <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${statusColor(reviewModal.current_status as AttendanceStatus)}`}>{statusLabel(reviewModal.current_status as AttendanceStatus)}</span></div>
                <div>Requested: <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${statusColor(reviewModal.requested_status as AttendanceStatus)}`}>{statusLabel(reviewModal.requested_status as AttendanceStatus)}</span></div>
              </div>
              <div className="text-xs"><strong>Agent's reason:</strong> {reviewModal.reason || '—'}</div>
              <div>
                <label className="text-xs font-medium mb-1 block">Admin note (optional)</label>
                <Textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Add a note..." className="text-xs h-16" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={reviewRequestMutation.isPending}
              onClick={() => reviewModal && reviewRequestMutation.mutate({
                requestId: reviewModal.id,
                status: 'rejected',
                note: reviewNote,
                agentId: reviewModal.agent_id,
                date: reviewModal.date,
                requestedStatus: reviewModal.requested_status,
                currentStatus: reviewModal.current_status,
              })}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
            <Button
              size="sm"
              disabled={reviewRequestMutation.isPending}
              onClick={() => reviewModal && reviewRequestMutation.mutate({
                requestId: reviewModal.id,
                status: 'approved',
                note: reviewNote,
                agentId: reviewModal.agent_id,
                date: reviewModal.date,
                requestedStatus: reviewModal.requested_status,
                currentStatus: reviewModal.current_status,
              })}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
