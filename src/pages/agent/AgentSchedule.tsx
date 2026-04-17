import React, { useMemo } from 'react';
import { Calendar, Sun, Clock, Moon, Wrench, ChevronRight } from 'lucide-react';
import { useMyShifts, formatDate, getWeekDates, DAY_LABELS, type AgentShiftRow, type ShiftTemplateRow } from '@/hooks/useShiftData';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';

const shiftIcons: Record<string, React.ElementType> = { morning: Sun, afternoon: Clock, evening: Moon, custom: Wrench };
const shiftColors: Record<string, string> = {
  morning: 'border-warning/30 bg-warning/5',
  afternoon: 'border-info/30 bg-info/5',
  evening: 'border-primary/30 bg-primary/5',
  custom: 'border-border bg-muted/30',
};
const shiftTextColors: Record<string, string> = {
  morning: 'text-warning',
  afternoon: 'text-info',
  evening: 'text-primary',
  custom: 'text-muted-foreground',
};

export default function AgentSchedule() {
  const weekDates = useMemo(() => getWeekDates(0), []);
  const nextWeekDates = useMemo(() => getWeekDates(1), []);
  const allStart = formatDate(weekDates[0]);
  const allEnd = formatDate(nextWeekDates[6]);

  const { data: shifts = [], isLoading } = useMyShifts(allStart, allEnd);

  const shiftMap = useMemo(() => {
    const map: Record<string, AgentShiftRow> = {};
    for (const s of shifts) map[s.date] = s;
    return map;
  }, [shifts]);

  const todayStr = formatDate(new Date());
  const todayShift = shiftMap[todayStr];
  const todayTemplate = todayShift?.shift_template as ShiftTemplateRow | undefined;

  // Find next off day
  const allDates = [...weekDates, ...nextWeekDates];
  const nextOff = allDates.find(d => {
    const ds = formatDate(d);
    return ds > todayStr && shiftMap[ds]?.is_off_day;
  });
  const nextOffLabel = nextOff
    ? nextOff.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
    : 'Not scheduled';

  return (
    <div className="space-y-6">
      {/* Today's Shift Card */}
      <div className="rounded-lg border bg-card shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Today's Schedule
          </h3>
          <span className="text-xs text-muted-foreground">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading schedule...</p>
        ) : todayShift?.is_off_day ? (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-dashed">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-lg">🏖️</span>
            </div>
            <div>
              <p className="font-semibold text-lg">Off Day</p>
              <p className="text-sm text-muted-foreground">Enjoy your day off! Your next shift is on the roster below.</p>
            </div>
          </div>
        ) : todayTemplate ? (
          <div className={cn('flex items-center gap-4 p-4 rounded-lg border', shiftColors[todayTemplate.type])}>
            {(() => { const Icon = shiftIcons[todayTemplate.type] || Wrench; return (
              <div className={cn('h-12 w-12 rounded-full flex items-center justify-center', `bg-${shiftTextColors[todayTemplate.type]?.split('-')[1]}/10`)}>
                <Icon className={cn('h-6 w-6', shiftTextColors[todayTemplate.type])} />
              </div>
            ); })()}
            <div className="flex-1">
              <p className="font-semibold text-lg">{todayTemplate.name} Shift</p>
              <p className="text-sm text-muted-foreground">
                {todayTemplate.start_time} – {todayTemplate.end_time} IST
              </p>
            </div>
            <StatusBadge variant="active">Working Day</StatusBadge>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-dashed">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No shift assigned</p>
              <p className="text-sm text-muted-foreground">Contact your admin for schedule details.</p>
            </div>
          </div>
        )}

        {/* Quick Info */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Next Off Day</p>
            <p className="text-sm font-medium mt-1">{nextOffLabel}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Shift Type</p>
            <p className="text-sm font-medium mt-1">{todayShift?.is_off_day ? 'Off' : todayTemplate?.name || 'Unassigned'}</p>
          </div>
        </div>
      </div>

      {/* This Week Roster */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold text-sm">This Week</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {weekDates[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {weekDates[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="grid grid-cols-7 gap-2 p-4">
          {weekDates.map((d, i) => {
            const dateStr = formatDate(d);
            const shift = shiftMap[dateStr];
            const template = shift?.shift_template as ShiftTemplateRow | undefined;
            const isToday = dateStr === todayStr;
            const Icon = template ? (shiftIcons[template.type] || Wrench) : Calendar;

            return (
              <div key={i} className={cn(
                'rounded-lg border p-3 text-center transition-all',
                isToday && 'ring-2 ring-primary/30',
                shift?.is_off_day ? 'bg-muted/30 border-dashed' : template ? shiftColors[template.type] : 'bg-background'
              )}>
                <p className={cn('text-xs font-bold uppercase', isToday ? 'text-primary' : 'text-muted-foreground')}>{DAY_LABELS[i]}</p>
                <p className="text-[10px] text-muted-foreground">{d.getDate()}/{d.getMonth() + 1}</p>
                <div className="mt-2">
                  {shift?.is_off_day ? (
                    <span className="text-xs font-semibold text-muted-foreground">OFF</span>
                  ) : template ? (
                    <>
                      <Icon className={cn('h-4 w-4 mx-auto', shiftTextColors[template.type])} />
                      <p className="text-[10px] font-semibold mt-1">{template.name}</p>
                      <p className="text-[9px] text-muted-foreground">{template.start_time}–{template.end_time}</p>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Week Preview */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold text-sm">Next Week</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {nextWeekDates[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {nextWeekDates[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="grid grid-cols-7 gap-2 p-4">
          {nextWeekDates.map((d, i) => {
            const dateStr = formatDate(d);
            const shift = shiftMap[dateStr];
            const template = shift?.shift_template as ShiftTemplateRow | undefined;
            const Icon = template ? (shiftIcons[template.type] || Wrench) : Calendar;

            return (
              <div key={i} className={cn(
                'rounded-lg border p-3 text-center',
                shift?.is_off_day ? 'bg-muted/30 border-dashed' : template ? shiftColors[template.type] : 'bg-background'
              )}>
                <p className="text-xs font-bold uppercase text-muted-foreground">{DAY_LABELS[i]}</p>
                <p className="text-[10px] text-muted-foreground">{d.getDate()}/{d.getMonth() + 1}</p>
                <div className="mt-2">
                  {shift?.is_off_day ? (
                    <span className="text-xs font-semibold text-muted-foreground">OFF</span>
                  ) : template ? (
                    <>
                      <Icon className={cn('h-4 w-4 mx-auto', shiftTextColors[template.type])} />
                      <p className="text-[10px] font-semibold mt-1">{template.name}</p>
                      <p className="text-[9px] text-muted-foreground">{template.start_time}–{template.end_time}</p>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
