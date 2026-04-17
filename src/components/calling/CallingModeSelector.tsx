import React from 'react';
import { cn } from '@/lib/utils';
import { Phone, List, Megaphone, PhoneIncoming } from 'lucide-react';

export type CallingMode = 'manual' | 'queue' | 'campaign' | 'incoming';

interface CallingModeSelectorProps {
  mode: CallingMode;
  onChange: (mode: CallingMode) => void;
}

const modes = [
  { id: 'manual' as const, label: 'Manual', icon: Phone, desc: 'Precision calling' },
  { id: 'queue' as const, label: 'Queue', icon: List, desc: 'Smart queue' },
  { id: 'campaign' as const, label: 'Campaign', icon: Megaphone, desc: 'Auto campaigns' },
  { id: 'incoming' as const, label: 'Incoming', icon: PhoneIncoming, desc: 'Inbound calls' },
];

export function CallingModeSelector({ mode, onChange }: CallingModeSelectorProps) {
  return (
    <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
      {modes.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
            mode === m.id
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <m.icon className="h-4 w-4" />
          {m.label}
        </button>
      ))}
    </div>
  );
}
