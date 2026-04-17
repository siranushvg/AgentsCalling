import React from 'react';
import { Users, Sun, Clock, Moon, Wrench, AlertTriangle, UserX } from 'lucide-react';
import type { DaySchedule } from './rosterUtils';

interface RosterSummaryBarProps {
  schedule: DaySchedule;
  understaffedDaysThisWeek?: number;
}

function StatChip({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border">
      <Icon className={`h-4 w-4 ${color}`} />
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

export function RosterSummaryBar({ schedule, understaffedDaysThisWeek = 0 }: RosterSummaryBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <StatChip icon={Users} label="Scheduled" value={schedule.totalActive} color="text-success" />
      <StatChip icon={UserX} label="Off today" value={schedule.totalOff} color="text-muted-foreground" />
      <div className="w-px h-6 bg-border mx-1" />
      <StatChip icon={Sun} label="Morning" value={schedule.morningCount} color="text-warning" />
      <StatChip icon={Clock} label="Afternoon" value={schedule.afternoonCount} color="text-info" />
      <StatChip icon={Moon} label="Evening" value={schedule.eveningCount} color="text-primary" />
      {schedule.customCount > 0 && (
        <StatChip icon={Wrench} label="Custom" value={schedule.customCount} color="text-muted-foreground" />
      )}
      {understaffedDaysThisWeek > 0 && (
        <>
          <div className="w-px h-6 bg-border mx-1" />
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xs font-medium text-destructive">{understaffedDaysThisWeek} understaffed day{understaffedDaysThisWeek > 1 ? 's' : ''}</span>
          </div>
        </>
      )}
    </div>
  );
}
