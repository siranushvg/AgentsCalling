import React from 'react';

export function CoverageLegend() {
  return (
    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded bg-success/30" /> Full coverage
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded bg-destructive/20" /> Understaffed
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded bg-primary/10" /> Weekend
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded bg-warning/30" /> Has overrides
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-3 rounded ring-2 ring-primary" /> Today
      </div>
    </div>
  );
}
