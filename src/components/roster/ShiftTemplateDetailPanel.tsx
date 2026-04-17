import React from 'react';
import { X, Sun, Clock, Moon, Wrench } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { ShiftAssignment } from './rosterUtils';
import { cn } from '@/lib/utils';

interface ShiftTemplateDetailPanelProps {
  shiftType: string;
  assignments: ShiftAssignment[];
  dateLabel: string;
  onClose: () => void;
}

const shiftIcons: Record<string, React.ElementType> = {
  morning: Sun, afternoon: Clock, evening: Moon, custom: Wrench,
};

const shiftLabels: Record<string, string> = {
  morning: 'Morning Shift', afternoon: 'Afternoon Shift', evening: 'Evening Shift', custom: 'Custom Shift',
};

export function ShiftTemplateDetailPanel({ shiftType, assignments, dateLabel, onClose }: ShiftTemplateDetailPanelProps) {
  const Icon = shiftIcons[shiftType] || Wrench;
  const working = assignments.filter(a => !a.isOffDay);
  const timeRange = working.length > 0 ? `${working[0].shiftTemplate.start_time} – ${working[0].shiftTemplate.end_time} IST` : '';

  return (
    <div className="rounded-lg border bg-card shadow-sm animate-in slide-in-from-top-2 duration-200">
      <div className="border-b px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">{shiftLabels[shiftType] || 'Shift'}</h3>
            <p className="text-xs text-muted-foreground">{timeRange} · {dateLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {working.length} agent{working.length !== 1 ? 's' : ''}
          </span>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="divide-y max-h-[300px] overflow-y-auto">
        {working.map(a => (
          <div key={a.agent.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                {a.agent.full_name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <p className="text-sm font-medium">{a.agent.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{a.agent.languages.slice(0, 2).join(', ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{a.shiftTemplate.start_time} – {a.shiftTemplate.end_time}</span>
              {a.isOverride && (
                <StatusBadge variant="warning">Override</StatusBadge>
              )}
              <StatusBadge variant="active">Working</StatusBadge>
            </div>
          </div>
        ))}
        {working.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No agents assigned to this shift</div>
        )}
      </div>
    </div>
  );
}
