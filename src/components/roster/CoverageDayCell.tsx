import React, { useState } from 'react';
import { Sun, Clock, Moon, Users, AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DaySchedule } from './rosterUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CoverageDayCellProps {
  schedule: DaySchedule;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export function CoverageDayCell({ schedule, isCurrentMonth, isToday, isSelected, onClick }: CoverageDayCellProps) {
  const { date, totalActive, totalOff, morningCount, afternoonCount, eveningCount, hasOverrides, isUnderstaffed } = schedule;
  const dow = (date.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const isWeekend = dow >= 5;
  const dayNum = date.getDate();

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'relative rounded-lg p-2 min-h-[80px] text-left transition-all w-full group',
              'hover:shadow-md hover:ring-1 hover:ring-primary/20 cursor-pointer',
              !isCurrentMonth && 'opacity-30 pointer-events-none',
              isToday && 'ring-2 ring-primary shadow-sm',
              isSelected && 'ring-2 ring-primary bg-primary/5 shadow-md',
              isWeekend ? 'bg-primary/[0.03]' : isUnderstaffed ? 'bg-destructive/[0.04]' : 'bg-card',
              'border border-transparent',
              isCurrentMonth && !isSelected && 'hover:border-border'
            )}
          >
            {/* Day number + indicators */}
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn(
                'text-xs font-semibold',
                isToday ? 'bg-primary text-primary-foreground px-1.5 py-0.5 rounded' : 'text-foreground'
              )}>
                {dayNum}
              </span>
              <div className="flex items-center gap-0.5">
                {hasOverrides && <RotateCcw className="h-2.5 w-2.5 text-warning" />}
                {isUnderstaffed && <AlertTriangle className="h-2.5 w-2.5 text-destructive" />}
              </div>
            </div>

            {isCurrentMonth && (
              <>
                {/* Total active */}
                <div className="flex items-center gap-1 mb-1.5">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className={cn(
                    'text-sm font-bold',
                    isUnderstaffed ? 'text-destructive' : 'text-foreground'
                  )}>
                    {totalActive}
                  </span>
                  {totalOff > 0 && (
                    <span className="text-[9px] text-muted-foreground">({totalOff} off)</span>
                  )}
                </div>

                {/* Shift breakdown */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Sun className="h-2.5 w-2.5 text-warning" />
                    <span className="text-[10px] text-muted-foreground">AM</span>
                    <span className="text-[10px] font-semibold text-foreground ml-auto">{morningCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5 text-info" />
                    <span className="text-[10px] text-muted-foreground">Day</span>
                    <span className="text-[10px] font-semibold text-foreground ml-auto">{afternoonCount + eveningCount}</span>
                  </div>
                </div>
              </>
            )}
          </button>
        </TooltipTrigger>
        {isCurrentMonth && (
          <TooltipContent side="top" className="text-xs">
            <p className="font-medium">{totalActive} scheduled · {totalOff} off</p>
            <p className="text-muted-foreground">Morning {morningCount} · Afternoon {afternoonCount} · Evening {eveningCount}</p>
            {hasOverrides && <p className="text-warning">Has overrides</p>}
            <p className="text-muted-foreground mt-1">Click for details</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
