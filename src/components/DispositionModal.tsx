import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { X, CheckCircle, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type DispositionType = 'interested' | 'callback' | 'not_interested' | 'no_answer' | 'wrong_number' | 'language_mismatch' | 'converted';

export interface ScheduleData {
  date: Date;
  timeSlot: string;
  reason: string;
}

interface DispositionModalProps {
  open: boolean;
  leadName: string;
  callDuration: number;
  onSubmit: (disposition: DispositionType, notes: string, schedule?: ScheduleData) => void;
  onClose: () => void;
}

const dispositions: { value: DispositionType; label: string; color: string; desc: string }[] = [
  { value: 'converted', label: 'Committed (FTD)', color: 'bg-success/15 text-success border-success/30', desc: 'Lead committed to their first deposit during or after this call' },
  { value: 'interested', label: 'Interested', color: 'bg-earning/15 text-earning border-earning/30', desc: 'Lead showed genuine interest but hasn\'t deposited yet' },
  { value: 'callback', label: 'Callback Scheduled', color: 'bg-info/15 text-info border-info/30', desc: 'Lead asked to be called back at a specific time' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-muted text-muted-foreground border-border', desc: 'Lead clearly declined — do not follow up' },
  { value: 'no_answer', label: 'No Answer', color: 'bg-warning/15 text-warning border-warning/30', desc: 'Call rang but was not picked up' },
  { value: 'wrong_number', label: 'Wrong Number / Lost', color: 'bg-destructive/15 text-destructive border-destructive/30', desc: 'Number doesn\'t belong to the lead, is invalid, or lead is lost' },
  { value: 'language_mismatch', label: 'Language Mismatch', color: 'bg-primary/15 text-primary border-primary/30', desc: 'Lead speaks a language you can\'t support — consider reassignment' },
];

const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
];

export function DispositionModal({ open, leadName, callDuration, onSubmit, onClose }: DispositionModalProps) {
  const [selected, setSelected] = useState<DispositionType | null>(null);
  const [notes, setNotes] = useState('');
  const [wantsSchedule, setWantsSchedule] = useState<boolean | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleReason, setScheduleReason] = useState('');

  if (!open) return null;

  const scheduleValid = wantsSchedule === false || (wantsSchedule === true && scheduleDate && scheduleTime);
  const canSubmit = selected && (wantsSchedule !== null) && scheduleValid;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const schedule: ScheduleData | undefined = wantsSchedule && scheduleDate && scheduleTime
      ? { date: scheduleDate, timeSlot: scheduleTime, reason: scheduleReason }
      : undefined;
    onSubmit(selected!, notes, schedule);
    resetForm();
  };

  const resetForm = () => {
    setSelected(null);
    setNotes('');
    setWantsSchedule(null);
    setScheduleDate(undefined);
    setScheduleTime('');
    setScheduleReason('');
  };

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const selectedDisp = dispositions.find(d => d.value === selected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg max-h-[90vh] rounded-lg border bg-card shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="font-semibold">Call Disposition</h3>
            <p className="text-sm text-muted-foreground">{leadName} · {formatDuration(callDuration)} · Complete the form below</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 1. Outcome */}
          <div className="space-y-2">
            <Label>1. Outcome *</Label>
            <div className="grid grid-cols-2 gap-2">
              {dispositions.map(d => (
                <button
                  key={d.value}
                  onClick={() => setSelected(d.value)}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all',
                    selected === d.value ? d.color + ' ring-1 ring-current' : 'border-border hover:bg-accent/50'
                  )}
                >
                  {selected === d.value && <CheckCircle className="h-3.5 w-3.5 inline mr-1.5" />}
                  {d.label}
                </button>
              ))}
            </div>
            {selectedDisp && (
              <p className="text-xs text-muted-foreground mt-1">{selectedDisp.desc}</p>
            )}
          </div>

          {/* 2. Schedule Next Call */}
          {selected && (
            <div className="space-y-3">
              <Label>2. Schedule Next Call?</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => { setWantsSchedule(true); }}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                    wantsSchedule === true
                      ? 'bg-primary/10 text-primary border-primary/30 ring-1 ring-primary/30'
                      : 'border-border hover:bg-accent/50'
                  )}
                >
                  <CalendarClock className="h-4 w-4 inline mr-1.5" />
                  Yes, schedule
                </button>
                <button
                  onClick={() => { setWantsSchedule(false); setScheduleDate(undefined); setScheduleTime(''); setScheduleReason(''); }}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                    wantsSchedule === false
                      ? 'bg-muted text-foreground border-border ring-1 ring-border'
                      : 'border-border hover:bg-accent/50'
                  )}
                >
                  No, skip
                </button>
              </div>

              {wantsSchedule === true && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Date *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn('w-full justify-start text-left text-sm font-normal', !scheduleDate && 'text-muted-foreground')}>
                            {scheduleDate ? format(scheduleDate, 'MMM d, yyyy') : 'Pick date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={scheduleDate}
                            onSelect={setScheduleDate}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Time Slot *</Label>
                      <select
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Select time</option>
                        {timeSlots.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Callback Reason (optional)</Label>
                    <input
                      value={scheduleReason}
                      onChange={e => setScheduleReason(e.target.value)}
                      placeholder="e.g. Lead prefers evening calls, wants to discuss bonus..."
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Notes (optional) */}
          {selected && wantsSchedule !== null && (
            <div className="space-y-2">
              <Label>3. Notes (optional)</Label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Lead asked about premium features, prefers WhatsApp follow-up..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Add a short summary if needed.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4">
          <p className="text-xs text-muted-foreground">
            {!selected ? 'Select an outcome to continue' : !wantsSchedule && wantsSchedule !== false ? 'Choose whether to schedule' : 'Ready to save'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              Save Disposition
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
