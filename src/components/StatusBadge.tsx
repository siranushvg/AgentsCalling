import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        active: 'bg-success/15 text-success',
        pending: 'bg-warning/15 text-warning',
        training: 'bg-info/15 text-info',
        suspended: 'bg-destructive/15 text-destructive',
        terminated: 'bg-muted text-muted-foreground',
        hot: 'bg-hot/15 text-hot',
        warm: 'bg-warm/15 text-warm',
        cool: 'bg-cool/15 text-cool',
        eligible: 'bg-success/15 text-success',
        at_risk: 'bg-warning/15 text-warning',
        not_eligible: 'bg-destructive/15 text-destructive',
        connected: 'bg-success/15 text-success',
        ringing: 'bg-info/15 text-info animate-pulse-soft',
        on_hold: 'bg-warning/15 text-warning',
        completed: 'bg-muted text-muted-foreground',
        new: 'bg-primary/15 text-primary',
        assigned: 'bg-info/15 text-info',
        contacted: 'bg-success/15 text-success',
        callback: 'bg-warning/15 text-warning',
        converted: 'bg-earning/15 text-earning',
        read: 'bg-success/15 text-success',
        delivered: 'bg-info/15 text-info',
        sent: 'bg-muted text-muted-foreground',
        failed: 'bg-destructive/15 text-destructive',
        missed: 'bg-warning/15 text-warning',
        whatsapp: 'bg-success/15 text-success',
        sms: 'bg-info/15 text-info',
        rcs: 'bg-primary/15 text-primary',
        paid: 'bg-success/15 text-success',
        processed: 'bg-info/15 text-info',
        withheld: 'bg-destructive/15 text-destructive',
        low: 'bg-warning/15 text-warning',
        warning: 'bg-warning/15 text-warning',
        medium: 'bg-warm/15 text-warm',
        high: 'bg-destructive/15 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'active',
    },
  }
);

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}
