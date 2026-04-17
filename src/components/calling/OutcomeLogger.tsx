import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type CallOutcome = 'connected' | 'no_answer' | 'busy' | 'converted' | 'not_interested' | 'callback' | 'wrong_number' | 'failed';

const outcomes: { value: CallOutcome; label: string; color: string }[] = [
  { value: 'connected', label: 'Connected', color: 'bg-info/10 text-info' },
  { value: 'converted', label: 'Converted', color: 'bg-success/10 text-success' },
  { value: 'callback', label: 'Callback', color: 'bg-warning/10 text-warning' },
  { value: 'no_answer', label: 'No Answer', color: 'bg-muted text-muted-foreground' },
  { value: 'busy', label: 'Busy', color: 'bg-muted text-muted-foreground' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-destructive/10 text-destructive' },
  { value: 'wrong_number', label: 'Wrong Number', color: 'bg-destructive/10 text-destructive' },
  { value: 'failed', label: 'Failed', color: 'bg-destructive/10 text-destructive' },
];

interface OutcomeLoggerProps {
  onSubmit: (outcome: CallOutcome, notes: string) => void;
  onCancel?: () => void;
  leadName: string;
  callDuration: number;
  required?: boolean;
}

export function OutcomeLogger({ onSubmit, onCancel, leadName, callDuration, required = true }: OutcomeLoggerProps) {
  const [outcome, setOutcome] = useState<CallOutcome | ''>('');
  const [notes, setNotes] = useState('');

  const canSubmit = outcome !== '' && (!required || notes.trim().length > 0);

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">Log Call Outcome</h4>
          <p className="text-sm text-muted-foreground">{leadName} · {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {outcomes.map(o => (
          <button
            key={o.value}
            onClick={() => setOutcome(o.value)}
            className={cn(
              'rounded-md border px-3 py-2 text-xs font-medium transition-all',
              outcome === o.value
                ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                : 'border-border hover:bg-accent'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <Textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Call notes (required)..."
        className="resize-none h-20"
      />

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        )}
        <Button size="sm" disabled={!canSubmit} onClick={() => onSubmit(outcome as CallOutcome, notes)}>
          Save & Continue
        </Button>
      </div>
    </div>
  );
}
