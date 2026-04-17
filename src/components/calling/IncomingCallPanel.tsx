import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Phone, PhoneIncoming, MessageSquare, Link, CalendarClock,
  Star, CheckCircle, X, Loader2, MessageCircle,
} from 'lucide-react';
import { DispositionModal, type DispositionType, type ScheduleData } from '@/components/DispositionModal';
import { WhatsAppMessageModal } from '@/components/calling/WhatsAppMessageModal';
import { WhatsAppLinkModal } from '@/components/calling/WhatsAppLinkModal';
import { SmsMessageModal } from '@/components/calling/SmsMessageModal';
import { maskPhone } from '@/lib/maskPhone';
import { supabase } from '@/integrations/supabase/client';
import { useScheduledCallbacks } from '@/hooks/useScheduledCallbacks';
import { addHistoryEntry } from '@/components/workspace/LeadHistoryPanel';
import { toast } from 'sonner';
import type { Lead } from '@/types';
import { cn } from '@/lib/utils';

interface IncomingCallPanelProps {
  callerNumber: string | null;
  callState: 'ringing' | 'connected' | 'on_hold' | 'ended';
  callDuration: number;
  callRecordId: string | null;
  onDismiss: () => void;
}

const formatElapsed = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export function IncomingCallPanel({
  callerNumber,
  callState,
  callDuration,
  callRecordId,
  onDismiss,
}: IncomingCallPanelProps) {
  const [matchedLead, setMatchedLead] = useState<Lead | null>(null);
  const [searching, setSearching] = useState(false);
  const [showDisposition, setShowDisposition] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showWhatsAppLink, setShowWhatsAppLink] = useState(false);
  const [showSms, setShowSms] = useState(false);
  const [notes, setNotes] = useState('');
  const [addedToPriority, setAddedToPriority] = useState(false);
  const [dispositionSaved, setDispositionSaved] = useState(false);
  const { addCallback } = useScheduledCallbacks();
  const callEndedRef = React.useRef(false);

  // When call ends, show post-call workflow
  const isCallActive = callState === 'ringing' || callState === 'connected' || callState === 'on_hold';
  const isPostCall = callState === 'ended';

  // Track if call has ended at least once
  useEffect(() => {
    if (isPostCall) callEndedRef.current = true;
  }, [isPostCall]);

  // Auto-open disposition modal when call ends (only once, only if not already saved)
  useEffect(() => {
    if (isPostCall && !dispositionSaved && !showDisposition) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => setShowDisposition(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isPostCall, dispositionSaved]);

  // Match caller number to lead
  useEffect(() => {
    if (!callerNumber) return;
    setSearching(true);

    const digits = callerNumber.replace(/[^0-9]/g, '');
    const last10 = digits.slice(-10);

    supabase
      .from('leads')
      .select('*')
      .eq('normalized_phone', last10)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMatchedLead(data[0] as unknown as Lead);
        }
        setSearching(false);
      });
  }, [callerNumber]);

  // Add to priority queue
  const handleAddToPriority = async () => {
    if (!matchedLead) {
      toast.error('No matched lead to add to priority queue');
      return;
    }
    try {
      await addCallback({
        leadId: matchedLead.id,
        leadName: matchedLead.username,
        disposition: 'callback',
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        reason: 'Incoming call — needs follow-up',
        status: 'pending',
      });
      setAddedToPriority(true);
      toast.success('Lead added to Priority Queue');
    } catch {
      toast.error('Failed to add to Priority Queue');
    }
  };

  // Disposition submit
  const handleDispositionSubmit = async (
    disposition: DispositionType,
    dispNotes: string,
    schedule?: ScheduleData,
  ) => {
    if (matchedLead) {
      addHistoryEntry(matchedLead.id, {
        type: 'call',
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        summary: dispNotes || 'Incoming call',
        agent: 'You',
        disposition,
      });

      // Persist via edge function — uses the inbound callRecordId
      await supabase.functions.invoke('save-call-disposition', {
        body: {
          leadId: matchedLead.id,
          callRecordId,
          disposition,
          notes: dispNotes || notes || null,
        },
      });

      // Sync agent-lead mapping to Back Office (non-blocking)
      supabase.functions.invoke('sync-calling-agent', {
        body: { leadId: matchedLead.id, reason: `inbound_disposition_${disposition}` },
      }).then(({ error }) => {
        if (error) console.error('BO sync failed (non-fatal):', error);
      });

      // Update lead status
      const newStatus = disposition === 'converted' ? 'converted'
        : disposition === 'not_interested' ? 'not_interested'
        : disposition === 'callback' ? 'callback'
        : 'contacted';

      await supabase.from('leads').update({
        status: newStatus,
        last_called_at: new Date().toISOString(),
      }).eq('id', matchedLead.id);

      if (schedule) {
        const scheduledAt = schedule.date instanceof Date
          ? new Date(schedule.date.setHours(
              parseInt(schedule.timeSlot.split(':')[0] || '9'),
              parseInt(schedule.timeSlot.split(':')[1] || '0'),
            ))
          : new Date();
        await addCallback({
          leadId: matchedLead.id,
          leadName: matchedLead.username,
          disposition,
          scheduledAt,
          reason: schedule.reason,
          status: 'pending',
        });
        toast.success('Callback scheduled and added to Priority Queue');
      }
    }

    setDispositionSaved(true);
    toast.success(`Disposition saved: ${disposition}`);
    setShowDisposition(false);
  };

  const stateLabel = {
    ringing: 'Incoming Call — Ringing',
    connected: 'Incoming Call — Connected',
    on_hold: 'Incoming Call — On Hold',
    ended: 'Incoming Call — Ended',
  }[callState];

  const stateColor = {
    ringing: 'border-warning bg-warning/5',
    connected: 'border-success bg-success/5',
    on_hold: 'border-info bg-info/5',
    ended: 'border-muted bg-muted/30',
  }[callState];

  const maskedCallerPhone = callerNumber ? maskPhone(callerNumber) : 'Unknown';

  return (
    <>
      <div className={cn('rounded-lg border-2 shadow-lg flex flex-col', stateColor)}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex items-center justify-center h-10 w-10 rounded-full',
              isCallActive ? 'bg-success/15 animate-pulse' : 'bg-muted',
            )}>
              <PhoneIncoming className={cn('h-5 w-5', isCallActive ? 'text-success' : 'text-muted-foreground')} />
            </div>
            <div>
              <p className="font-semibold text-sm">{stateLabel}</p>
              <p className="text-xs text-muted-foreground font-mono">{maskedCallerPhone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-mono font-medium">{formatElapsed(callDuration)}</p>
            </div>
            {callRecordId && (
              <Badge variant="outline" className="text-[9px] text-muted-foreground">
                Logged
              </Badge>
            )}
            {isPostCall && dispositionSaved && (
              <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
            {isPostCall && !dispositionSaved && (
              <Badge variant="outline" className="text-[9px] border-warning/40 text-warning">
                Needs Disposition
              </Badge>
            )}
          </div>
        </div>

        {/* Lead info */}
        <div className="px-5 py-4 space-y-4">
          {searching ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Looking up caller...
            </div>
          ) : matchedLead ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{matchedLead.username}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Language</p>
                <p className="text-sm font-medium">{matchedLead.language}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">State</p>
                <p className="text-sm font-medium">{matchedLead.state}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="outline" className="text-[10px]">{matchedLead.status}</Badge>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {callerNumber ? 'No matching lead found in the system' : 'Caller number not detected'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You can still use WhatsApp and other actions with the caller number
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {matchedLead && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWhatsApp(true)}
                  className="border-success/30 text-success hover:bg-success/10"
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWhatsAppLink(true)}
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Link className="mr-1.5 h-3.5 w-3.5" /> Send Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSms(true)}
                  className="border-warning/30 text-warning hover:bg-warning/10"
                >
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> SMS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddToPriority}
                  disabled={addedToPriority}
                  className="border-warning/30 text-warning hover:bg-warning/10"
                >
                  <Star className="mr-1.5 h-3.5 w-3.5" />
                  {addedToPriority ? 'Added ✓' : 'Priority Queue'}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowDisposition(true);
              }}
              disabled={dispositionSaved}
            >
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              {dispositionSaved ? 'Disposition Saved ✓' : 'Add Disposition'}
            </Button>
          </div>

          {/* Post-call section */}
          {isPostCall && !dispositionSaved && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
              <p className="text-sm font-medium text-warning">Post-Call Actions</p>
              <p className="text-xs text-muted-foreground mt-1">
                Save a disposition, send a WhatsApp follow-up, SMS, or add this lead to the Priority Queue before dismissing.
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Incoming call notes..."
              className="h-20 w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Save notes for matched lead */}
          {matchedLead && notes.trim() && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                addHistoryEntry(matchedLead.id, {
                  type: 'note',
                  date: new Date().toISOString().replace('T', ' ').slice(0, 16),
                  summary: notes,
                  agent: 'You',
                });
                toast.success('Notes saved');
              }}
            >
              Save Notes
            </Button>
          )}
        </div>
      </div>

      {/* Modals */}
      <DispositionModal
        open={showDisposition}
        leadName={matchedLead?.username || 'Unknown Caller'}
        callDuration={callDuration}
        onSubmit={handleDispositionSubmit}
        onClose={() => setShowDisposition(false)}
      />

      {matchedLead && (
        <>
          <WhatsAppMessageModal
            open={showWhatsApp}
            onClose={() => setShowWhatsApp(false)}
            leadId={matchedLead.id}
            leadName={matchedLead.username}
            maskedPhone={maskedCallerPhone}
          />
          <WhatsAppLinkModal
            open={showWhatsAppLink}
            onClose={() => setShowWhatsAppLink(false)}
            leadId={matchedLead.id}
            leadName={matchedLead.username}
            maskedPhone={maskedCallerPhone}
          />
          <SmsMessageModal
            open={showSms}
            onClose={() => setShowSms(false)}
            leadId={matchedLead.id}
            leadName={matchedLead.username}
            maskedPhone={maskedCallerPhone}
          />
        </>
      )}
    </>
  );
}
