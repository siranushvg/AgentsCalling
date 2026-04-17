import React from 'react';
import { X, Sun, Clock, Moon, Wrench, Users, UserX } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { DaySchedule, ShiftAssignment } from './rosterUtils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayCoverageDrawerProps {
  open: boolean;
  onClose: () => void;
  schedule: DaySchedule | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ShiftSection({ icon: Icon, label, color, assignments }: {
  icon: React.ElementType; label: string; color: string; assignments: ShiftAssignment[];
}) {
  if (assignments.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn('text-xs font-bold ml-auto', color)}>{assignments.length}</span>
      </div>
      <div className="rounded-lg border divide-y">
        {assignments.map(a => (
          <div key={a.agent.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                {a.agent.full_name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <p className="text-sm font-medium leading-tight">{a.agent.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{a.agent.languages.slice(0, 2).join(' · ')} · {a.agent.city}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">{a.shiftTemplate.start_time}–{a.shiftTemplate.end_time}</span>
              {a.isOverride && <StatusBadge variant="warning">Override</StatusBadge>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DayCoverageDrawer({ open, onClose, schedule }: DayCoverageDrawerProps) {
  if (!open || !schedule) return null;

  const { date, assignments, totalActive, totalOff, morningCount, afternoonCount, eveningCount, customCount } = schedule;
  const dayName = DAY_NAMES[date.getDay()];
  const dateStr = `${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;

  const morning = assignments.filter(a => !a.isOffDay && a.shiftTemplate.type === 'morning');
  const afternoon = assignments.filter(a => !a.isOffDay && a.shiftTemplate.type === 'afternoon');
  const evening = assignments.filter(a => !a.isOffDay && a.shiftTemplate.type === 'evening');
  const custom = assignments.filter(a => !a.isOffDay && a.shiftTemplate.type === 'custom');
  const offDay = assignments.filter(a => a.isOffDay);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed top-0 right-0 z-50 h-full w-[440px] border-l bg-card shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="border-b px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{dayName}, {dateStr}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Daily coverage breakdown</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 p-4 border-b">
          <div className="text-center p-2 rounded-lg bg-success/5">
            <p className="text-lg font-bold text-success">{totalActive}</p>
            <p className="text-[10px] text-muted-foreground">Scheduled</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-lg font-bold text-muted-foreground">{totalOff}</p>
            <p className="text-[10px] text-muted-foreground">Off Day</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/5">
            <p className="text-lg font-bold text-primary">{assignments.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Agents</p>
          </div>
        </div>

        {/* Shift breakdown bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b text-[10px]">
          <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-warning" /> AM {morningCount}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-info" /> PM {afternoonCount}</span>
          <span className="flex items-center gap-1"><Moon className="h-3 w-3 text-primary" /> Eve {eveningCount}</span>
          {customCount > 0 && <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> Custom {customCount}</span>}
        </div>

        {/* Agent lists */}
        <div className="overflow-y-auto h-[calc(100%-220px)] p-4 space-y-4">
          <ShiftSection icon={Sun} label="Morning (09:00–17:00)" color="text-warning" assignments={morning} />
          <ShiftSection icon={Clock} label="Afternoon (11:00–19:00)" color="text-info" assignments={afternoon} />
          <ShiftSection icon={Moon} label="Evening (13:00–21:00)" color="text-primary" assignments={evening} />
          {custom.length > 0 && (
            <ShiftSection icon={Wrench} label="Custom" color="text-muted-foreground" assignments={custom} />
          )}

          {offDay.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-1 py-1.5 rounded hover:bg-accent/50 transition-colors">
                <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Off Day</span>
                <span className="text-xs font-bold text-muted-foreground ml-auto mr-1">{offDay.length}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="rounded-lg border divide-y mt-1">
                  {offDay.map(a => (
                    <div key={a.agent.id} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {a.agent.full_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <p className="text-sm text-muted-foreground">{a.agent.full_name}</p>
                      </div>
                      <StatusBadge variant="terminated">Off</StatusBadge>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </>
  );
}
