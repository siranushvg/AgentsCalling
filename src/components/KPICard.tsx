import React from 'react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  avatars?: string[];
  onAvatarClick?: (name: string) => void;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function KPICard({ title, value, subtitle, icon, trend, avatars, onAvatarClick, className }: KPICardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={cn('text-xs font-medium', trend.positive ? 'text-success' : 'text-destructive')}>
              {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% vs last period
            </p>
          )}
          {avatars && avatars.length > 0 && (
            <div className="flex items-center gap-0.5 pt-1 flex-wrap">
              {avatars.slice(0, 8).map((name, i) => (
                <button
                  key={i}
                  title={name}
                  onClick={() => onAvatarClick?.(name)}
                  className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary leading-none hover:bg-primary/20 hover:scale-110 transition-all cursor-pointer"
                >
                  {getInitials(name)}
                </button>
              ))}
              {avatars.length > 8 && (
                <span className="text-[9px] text-muted-foreground font-medium ml-0.5">+{avatars.length - 8}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
