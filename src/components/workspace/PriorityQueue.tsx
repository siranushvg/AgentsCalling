import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, Bell, Phone, Flame, X } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

export interface ScheduledCallback {
  id: string;
  leadId: string;
  leadName: string;
  disposition: string;
  scheduledAt: Date;
  reason?: string;
  status: 'pending' | 'completed' | 'missed';
  isHotLead?: boolean;
}

type UrgencyState = 'normal' | 'urgent' | 'overdue' | 'hot';

function getUrgency(cb: ScheduledCallback): UrgencyState {
  if (cb.isHotLead) return 'hot';
  const diff = cb.scheduledAt.getTime() - Date.now();
  if (diff <= 0) return 'overdue';
  if (diff <= 60 * 60 * 1000) return 'urgent';
  return 'normal';
}

function formatCountdown(cb: ScheduledCallback): string {
  if (cb.isHotLead) return 'hot lead';
  const diff = cb.scheduledAt.getTime() - Date.now();
  const absDiff = Math.abs(diff);
  const hours = Math.floor(absDiff / (60 * 60 * 1000));
  const minutes = Math.floor((absDiff % (60 * 60 * 1000)) / (60 * 1000));

  if (Math.abs(diff) < 60 * 1000) return diff <= 0 ? 'overdue' : 'now';
  const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return diff <= 0 ? `overdue by ${timeStr}` : `in ${timeStr}`;
}

const urgencyStyles: Record<UrgencyState, string> = {
  hot: 'border-orange-400/50 bg-orange-50 dark:bg-orange-950/20',
  normal: 'border-border bg-card',
  urgent: 'border-warning/50 bg-warning/5',
  overdue: 'border-destructive/50 bg-destructive/5',
};

const urgencyBadge: Record<UrgencyState, { variant: React.ComponentProps<typeof StatusBadge>['variant']; label: string }> = {
  hot: { variant: 'hot', label: 'Hot Lead' },
  normal: { variant: 'cool', label: 'Scheduled' },
  urgent: { variant: 'warm', label: 'Urgent' },
  overdue: { variant: 'hot', label: 'Overdue' },
};

function sortItems(items: ScheduledCallback[]): ScheduledCallback[] {
  return [...items]
    .filter(cb => cb.status === 'pending')
    .sort((a, b) => {
      const uA = getUrgency(a);
      const uB = getUrgency(b);
      const order: Record<UrgencyState, number> = { overdue: 0, hot: 1, urgent: 2, normal: 3 };
      if (order[uA] !== order[uB]) return order[uA] - order[uB];
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
}

interface PriorityQueueProps {
  callbacks: ScheduledCallback[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
  onCall?: (leadId: string) => void;
  onDismiss?: (callbackId: string, leadId: string) => void;
}

export function PriorityQueue({ callbacks, selectedLeadId, onSelect, onCall, onDismiss }: PriorityQueueProps) {
  const [, setTick] = useState(0);

  // Update countdowns every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const sorted = sortItems(callbacks);
  const overdueCount = sorted.filter(cb => getUrgency(cb) === 'overdue').length;
  const hotCount = sorted.filter(cb => cb.isHotLead).length;

  return (
    <div className="w-64 flex-shrink-0 rounded-lg border bg-card shadow-sm flex flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Priority Queue</h3>
          <div className="flex items-center gap-2">
            {hotCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-orange-600">
                <Flame className="h-3 w-3" />
                {hotCount} hot
              </span>
            )}
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount} overdue
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{sorted.length} priority items</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground font-medium">No priority items right now</p>
            <p className="text-xs text-muted-foreground">Hot leads & scheduled callbacks appear here</p>
          </div>
        ) : (
          sorted.map(cb => {
            const urgency = getUrgency(cb);
            const countdown = formatCountdown(cb);
            const badge = urgencyBadge[urgency];
            return (
              <div
                key={cb.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(cb.leadId)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(cb.leadId); }}
                className={cn(
                  'w-full text-left px-4 py-3 border-b transition-all hover:bg-accent/50 cursor-pointer',
                  urgencyStyles[urgency],
                  selectedLeadId === cb.leadId && 'ring-1 ring-inset ring-primary/30',
                  urgency === 'overdue' && 'animate-pulse-subtle'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{cb.leadName}</span>
                  <StatusBadge variant={badge.variant}>{badge.label}</StatusBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground capitalize">
                    {cb.isHotLead ? 'high priority' : cb.disposition.replace('_', ' ')}
                  </span>
                  <span className={cn(
                    'text-xs font-medium flex items-center gap-1',
                    urgency === 'normal' && 'text-muted-foreground',
                    urgency === 'urgent' && 'text-warning',
                    urgency === 'overdue' && 'text-destructive',
                    urgency === 'hot' && 'text-orange-600'
                  )}>
                    {cb.isHotLead ? <Flame className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {countdown}
                  </span>
                </div>
                {cb.reason && (
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">{cb.reason}</p>
                )}
                <div className="flex items-center justify-between mt-1.5">
                  <button
                    type="button"
                    className={cn(
                      'flex items-center gap-1 text-[11px] font-medium cursor-pointer bg-transparent border-none p-0',
                      urgency === 'hot' || cb.isHotLead ? 'text-orange-600 hover:text-orange-700' : 
                      urgency === 'overdue' ? 'text-destructive' : 'text-primary hover:text-primary/80'
                    )}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onCall) onCall(cb.leadId);
                      else onSelect(cb.leadId);
                    }}
                  >
                    <Phone className="h-3 w-3" /> Call now
                  </button>
                  {onDismiss && (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[11px] font-medium cursor-pointer text-muted-foreground hover:text-destructive transition-colors bg-transparent border-none p-0"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDismiss(cb.id, cb.leadId);
                      }}
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
