import React from 'react';
import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({ rows = 5, cols = 6 }: TableSkeletonProps) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <div className="border-b bg-muted/50 px-4 py-3">
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className={cn(
                  'h-4 rounded bg-muted animate-pulse',
                  c === 0 ? 'w-32' : c === cols - 1 ? 'w-16 ml-auto' : 'w-20'
                )}
                style={{ animationDelay: `${(r * cols + c) * 50}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="rounded-full bg-muted p-4 text-muted-foreground">
        {icon}
      </div>
      <div className="text-center space-y-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm space-y-3 animate-pulse">
      <div className="h-3 w-24 bg-muted rounded" />
      <div className="h-8 w-20 bg-muted rounded" />
      <div className="h-3 w-32 bg-muted rounded" />
    </div>
  );
}
