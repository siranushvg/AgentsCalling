import React from 'react';
import { Sun, Clock, Moon, Wrench, ChevronRight } from 'lucide-react';
import { mockShiftTemplates } from '@/data/mockData';
import { cn } from '@/lib/utils';
import type { DaySchedule } from './rosterUtils';

interface ShiftTemplateCardsProps {
  schedule: DaySchedule;
  selectedShift: string | null;
  onSelectShift: (type: string) => void;
}

const shiftIcons: Record<string, React.ElementType> = {
  morning: Sun,
  afternoon: Clock,
  evening: Moon,
  custom: Wrench,
};

const shiftColors: Record<string, { bg: string; text: string; ring: string; badge: string }> = {
  morning: { bg: 'bg-warning/5', text: 'text-warning', ring: 'ring-warning/30', badge: 'bg-warning/15 text-warning' },
  afternoon: { bg: 'bg-info/5', text: 'text-info', ring: 'ring-info/30', badge: 'bg-info/15 text-info' },
  evening: { bg: 'bg-primary/5', text: 'text-primary', ring: 'ring-primary/30', badge: 'bg-primary/15 text-primary' },
  custom: { bg: 'bg-muted', text: 'text-muted-foreground', ring: 'ring-border', badge: 'bg-muted text-muted-foreground' },
};

export function ShiftTemplateCards({ schedule, selectedShift, onSelectShift }: ShiftTemplateCardsProps) {
  const countMap: Record<string, number> = {
    morning: schedule.morningCount,
    afternoon: schedule.afternoonCount,
    evening: schedule.eveningCount,
    custom: schedule.customCount,
  };

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-5 py-3">
        <h3 className="font-semibold text-sm">Shift Templates</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Click a shift to see assigned agents</p>
      </div>
      <div className="grid grid-cols-3 gap-3 p-4">
        {mockShiftTemplates.map(st => {
          const Icon = shiftIcons[st.type] || Wrench;
          const colors = shiftColors[st.type] || shiftColors.custom;
          const count = countMap[st.type] || 0;
          const isSelected = selectedShift === st.type;
          const totalActive = schedule.totalActive;
          const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;

          return (
            <button
              key={st.id}
              onClick={() => onSelectShift(isSelected ? '' : st.type)}
              className={cn(
                'relative rounded-lg border p-4 text-left transition-all hover:shadow-md cursor-pointer group',
                isSelected ? `ring-2 ${colors.ring} ${colors.bg} shadow-md` : 'hover:bg-accent/50'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn('p-2 rounded-lg', colors.bg)}>
                  <Icon className={cn('h-4 w-4', colors.text)} />
                </div>
                <ChevronRight className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  isSelected && 'rotate-90'
                )} />
              </div>
              <h4 className="font-semibold text-sm">{st.name} Shift</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{st.start_time} – {st.end_time} IST</p>
              <div className="flex items-center gap-2 mt-3">
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', colors.badge)}>
                  {count} agent{count !== 1 ? 's' : ''}
                </span>
                <span className="text-[10px] text-muted-foreground">{pct}% of staff</span>
              </div>
              {/* Coverage bar */}
              <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', colors.text.replace('text-', 'bg-'))} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
