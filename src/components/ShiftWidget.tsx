import React from 'react';
import { Clock, Activity, Calendar, Phone } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useMyShifts, type ShiftTemplateRow } from '@/hooks/useShiftData';
import { useShiftWidgetStats } from '@/hooks/useShiftWidgetStats';

interface ShiftWidgetProps {
  expanded?: boolean;
}

function getSalaryEligibility(hours: number, hoursTarget: number, calls: number, callsTarget: number) {
  const hoursOk = hours >= hoursTarget;
  const callsOk = calls >= callsTarget;
  if (hoursOk && callsOk) return 'eligible';
  if (hoursOk || callsOk) return 'at_risk';
  return 'not_eligible';
}

export function ShiftWidget({ expanded }: ShiftWidgetProps) {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in IST
  const { data: shifts = [] } = useMyShifts(todayStr, todayStr);
  const todayShift = shifts[0];
  const template = todayShift?.shift_template as ShiftTemplateRow | undefined;
  const { stats } = useShiftWidgetStats();

  // Current IST time for display
  const now = new Date();
  const istDateLabel = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const istTimeLabel = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

  const isWorkingDay = todayShift ? !todayShift.is_off_day : true;
  const shiftStart = template?.start_time || '--:--';
  const shiftEnd = template?.end_time || '--:--';
  const shiftName = template?.name || (todayShift ? 'Assigned' : 'No Shift');

  const eligibility = getSalaryEligibility(
    stats.activeHoursThisMonth, stats.hoursTarget,
    stats.callsThisWeek, stats.weeklyCallsTarget
  );

  const hoursOk = stats.activeHoursThisMonth >= stats.hoursTarget;
  const callsOk = stats.callsThisWeek >= stats.weeklyCallsTarget;

  if (expanded) {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Today's Shift
          </h4>
          <StatusBadge variant={isWorkingDay ? 'active' : 'terminated'}>
            {isWorkingDay ? `${shiftName} Shift` : 'Off Day'}
          </StatusBadge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Window:</span>
            <span className="font-medium">{shiftStart}–{shiftEnd}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Active:</span>
            <span className="font-medium">{stats.activeHoursToday}h today</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Logged in:</span>
            <span className="font-medium">{stats.loggedInSince || '--:--'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Monthly hrs:</span>
            <span className={`font-medium ${hoursOk ? 'text-success' : 'text-warning'}`}>
              {stats.activeHoursThisMonth}/{stats.hoursTarget}h
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Weekly calls:</span>
            <span className={`font-medium ${callsOk ? 'text-success' : 'text-warning'}`}>
              {stats.callsThisWeek}/{stats.weeklyCallsTarget}
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <StatusBadge variant={eligibility}>
            Salary: {eligibility === 'eligible' ? 'Full' : eligibility === 'at_risk' ? 'Partial' : 'Not Eligible'}
          </StatusBadge>
          {!hoursOk && (
            <span className="text-xs text-warning">Need {(stats.hoursTarget - stats.activeHoursThisMonth).toFixed(0)}h more</span>
          )}
          {!callsOk && (
            <span className="text-xs text-warning">Need {stats.weeklyCallsTarget - stats.callsThisWeek} more calls</span>
          )}
        </div>
      </div>
    );
  }

  // Compact version for top bar
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-1.5 text-xs">
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{istDateLabel}, {istTimeLabel}</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{todayShift ? `${shiftStart}–${shiftEnd}` : 'No Shift Assigned'}</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{stats.activeHoursThisMonth}/{stats.hoursTarget}h</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{stats.callsThisWeek}/{stats.weeklyCallsTarget}</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <StatusBadge variant={eligibility}>
        {eligibility === 'eligible' ? 'Full Salary' : eligibility === 'at_risk' ? 'Partial' : 'Not Eligible'}
      </StatusBadge>
    </div>
  );
}
