import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { DispositionModal, type DispositionType, type ScheduleData } from '@/components/DispositionModal';
import { LanguageReassignModal } from '@/components/LanguageReassignModal';
import { Phone, ArrowRightLeft, Loader2, MessageSquare, Link, PlayCircle, StopCircle, MessageCircle } from 'lucide-react';
import { useAgentCalling } from '@/contexts/AgentCallingContext';
import { IncomingCallPanel } from '@/components/calling/IncomingCallPanel';
import { useVoicelay as useVoicelayContext } from '@/contexts/VoicelayContext';
import { WhatsAppMessageModal } from '@/components/calling/WhatsAppMessageModal';
import { WhatsAppLinkModal } from '@/components/calling/WhatsAppLinkModal';
import { SmsMessageModal } from '@/components/calling/SmsMessageModal';
import { CallingModeSelector, type CallingMode } from '@/components/calling/CallingModeSelector';
import { maskPhone } from '@/lib/maskPhone';
import { Lead } from '@/types';
import { toast } from 'sonner';
import { LeadHistoryPanel, addHistoryEntry } from '@/components/workspace/LeadHistoryPanel';
import { CallScriptPanel } from '@/components/workspace/CallScriptPanel';
import { LeadQueue } from '@/components/workspace/LeadQueue';
import { PriorityQueue, type ScheduledCallback } from '@/components/workspace/PriorityQueue';
import { useScheduledCallbacks } from '@/hooks/useScheduledCallbacks';
import { useWorkspaceNotifications } from '@/contexts/WorkspaceNotificationContext';
import { supabase } from '@/integrations/supabase/client';

const QueueCallingMode = lazy(() => import('@/pages/agent/QueueCallingMode'));
const CampaignCallingMode = lazy(() => import('@/pages/agent/CampaignCallingMode'));
const IncomingCallsMode = lazy(() => import('@/pages/agent/IncomingCallsMode'));

// ── Note examples ────────────────────────────────────────────────────────
const noteExamples = [
  "Lead expressed interest in premium features. Requested WhatsApp follow-up.",
  "Callback scheduled — prefers evening calls after 6pm IST.",
  "Language mismatch — lead speaks Tamil, reassigned to Tamil-speaking agent.",
  "Not interested at this time. Polite close — do not call again.",
  "Converted on first call. Completed FTD during the conversation.",
];



type FiredTier = 'urgent' | 'due' | 'overdue';

const CALL_STATE_LABELS = {
  idle: 'Ready for a Voicelay call',
  initiating: 'Connecting via Voicelay API',
  ringing: 'Ringing in Voicelay',
  connected: 'Connected in Voicelay',
  on_hold: 'On hold in Voicelay',
  ended: 'Call completed',
  failed: 'Call failed',
} as const;

const formatElapsed = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export default function AgentWorkspace() {
  const {
    queueLeads,
    refetchQueue,
    callState,
    callDuration,
    callRecordId,
    lastError,
    initiateCall,
    endCall,
    resetState: resetVoicelayState,
    isActive,
    isInitiating,
    activeQueueLeadId,
    countdown,
    startQueue,
    stopQueue,
    isQueueActive,
    incomingCall,
    dismissIncomingCall,
  } = useAgentCalling();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [callingMode, setCallingMode] = useState<CallingMode>('manual');
  const [notes, setNotes] = useState('');
  const [showDisposition, setShowDisposition] = useState(false);
  const [dispositionLead, setDispositionLead] = useState<Lead | null>(null);
  const [dispositionDuration, setDispositionDuration] = useState(0);
  const [dispositionCallRecordId, setDispositionCallRecordId] = useState<string | null>(null);
  const lastCalledLeadRef = useRef<Lead | null>(null);
  const [showReassign, setShowReassign] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const { callbacks: scheduledCallbacks, addCallback: addScheduledCallback, completeCallback: completeScheduledCallback, dismissItem: dismissScheduledItem, removeByLeadId: removeFromPriorityQueue, refreshHotLeads } = useScheduledCallbacks();
  const [leadPhoneNumber, setLeadPhoneNumber] = useState<string | null>(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showWhatsAppLink, setShowWhatsAppLink] = useState(false);
  const [showSms, setShowSms] = useState(false);
  const activeCallbackLeadRef = useRef<string | null>(null);
  const firedNotifications = useRef<Map<string, Set<FiredTier>>>(new Map());
  const autoContactedLeadRef = useRef<string | null>(null);
  const callTargetLeadIdRef = useRef<string | null>(null);
  const isPrioritySelectionRef = useRef(false);
  const { isSoftphoneReady } = useVoicelayContext();

  const { addNotification } = useWorkspaceNotifications();

  const markLeadAsContacted = useCallback(async (lead: Lead) => {
    if (autoContactedLeadRef.current === lead.id) return true;

    const attemptCount = (lead as Lead & { total_call_attempts?: number }).total_call_attempts ?? 0;
    const { error } = await supabase
      .from('leads')
      .update({
        status: 'contacted' as any,
        last_called_at: new Date().toISOString(),
        total_call_attempts: attemptCount + 1,
      })
      .eq('id', lead.id);

    if (error) {
      console.error('Failed to move lead out of queue:', error);
      toast.error('Call started, but the lead could not be removed from the queue.');
      return false;
    }

    autoContactedLeadRef.current = lead.id;
    await refetchQueue();
    return true;
  }, [refetchQueue]);

  // Reset optimistic tracking when the agent changes the selected lead
  useEffect(() => {
    if (!selectedLead || autoContactedLeadRef.current !== selectedLead.id) {
      autoContactedLeadRef.current = null;
    }
    // If agent selects a DIFFERENT lead while the previous call's state is stale, force-reset voicelay
    if (selectedLead && callTargetLeadIdRef.current && callTargetLeadIdRef.current !== selectedLead.id && isActive) {
      console.log('[Workspace] Agent selected new lead while previous call state is stale — resetting voicelay');
      resetVoicelayState();
      callTargetLeadIdRef.current = null;
    }
  }, [selectedLead?.id, isActive, resetVoicelayState]);

  // During queue calling, sync selected lead to the active queue lead
  useEffect(() => {
    if (isQueueActive && activeQueueLeadId) {
      const lead = queueLeads.find(l => l.id === activeQueueLeadId);
      if (lead && selectedLead?.id !== activeQueueLeadId) {
        setSelectedLead(lead);
      }
    }
  }, [activeQueueLeadId, isQueueActive, queueLeads, selectedLead?.id]);

  // Auto-select the next lead when the current one is removed from the queue
  useEffect(() => {
    if (!selectedLead) return;
    if (isQueueActive) return;
    if (isPrioritySelectionRef.current) return; // Don't override priority queue selection
    const stillInQueue = queueLeads.some(l => l.id === selectedLead.id);
    if (!stillInQueue && !isActive) {
      if (queueLeads.length > 0) {
        setSelectedLead(queueLeads[0]);
        toast.info('Auto-selected next lead from queue');
      } else {
        setSelectedLead(null);
      }
    }
  }, [queueLeads, selectedLead, isActive, isQueueActive]);

  // ── Fetch lead phone number securely when lead is selected ─────────
  useEffect(() => {
    if (!selectedLead?.id) {
      setLeadPhoneNumber(null);
      return;
    }
    // Fetch the phone number from DB (agent can see assigned leads)
    supabase
      .from('leads')
      .select('phone_number')
      .eq('id', selectedLead.id)
      .single()
      .then(({ data }) => {
        setLeadPhoneNumber(data?.phone_number || null);
      });
  }, [selectedLead?.id]);

  // ── Smart notification engine (runs every 30s) ────────────────────────
  useEffect(() => {
    const check = () => {
      scheduledCallbacks.filter(cb => cb.status === 'pending' && !cb.isHotLead).forEach(cb => {
        const diff = cb.scheduledAt.getTime() - Date.now();
        const fired = firedNotifications.current.get(cb.id) ?? new Set<FiredTier>();

        if (diff <= 0 && !fired.has('overdue')) {
          fired.add('overdue');
          toast.error(`Scheduled callback with ${cb.leadName} is now overdue`, { id: `overdue-${cb.id}` });
          addNotification({ type: 'callback_overdue', title: 'Callback Overdue', message: `Follow-up with ${cb.leadName} is overdue. Call now.`, urgency: 'overdue', relatedLeadId: cb.leadId, relatedCallbackId: cb.id });
        } else if (diff <= 60 * 1000 && diff > 0 && !fired.has('due')) {
          fired.add('due');
          toast.warning(`Scheduled callback with ${cb.leadName} is now due`, { id: `due-${cb.id}` });
          addNotification({ type: 'callback_due', title: 'Callback Due Now', message: `Follow-up with ${cb.leadName} is due now.`, urgency: 'due', relatedLeadId: cb.leadId, relatedCallbackId: cb.id });
        } else if (diff <= 60 * 60 * 1000 && diff > 60 * 1000 && !fired.has('urgent')) {
          fired.add('urgent');
          const mins = Math.round(diff / (60 * 1000));
          toast.info(`Callback with ${cb.leadName} due in ${mins} minutes`, { id: `urgent-${cb.id}` });
          addNotification({ type: 'callback_reminder', title: 'Upcoming Callback', message: `Scheduled follow-up with ${cb.leadName} is due in ${mins} minutes.`, urgency: 'urgent', relatedLeadId: cb.leadId, relatedCallbackId: cb.id });
        }
        firedNotifications.current.set(cb.id, fired);
      });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [scheduledCallbacks, addNotification]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleStartCall = async () => {
    if (!selectedLead || !leadPhoneNumber) {
      toast.error('No lead or phone number available');
      return;
    }

    if (!isSoftphoneReady) {
      toast.error('Voicelay softphone is still connecting. Wait for Connected status, then retry.');
      return;
    }

    setShowScript(false);
    callTargetLeadIdRef.current = selectedLead.id;
    lastCalledLeadRef.current = selectedLead;
    const sessionId = await initiateCall(leadPhoneNumber, selectedLead.id, 'workspace');
    if (!sessionId) {
      callTargetLeadIdRef.current = null;
      lastCalledLeadRef.current = null;
      return;
    }

    const moved = await markLeadAsContacted(selectedLead);
    if (moved) {
      toast.success('Call started — lead moved out of queue. You can still add a disposition later.');
      // Auto-remove from priority queue if present
      removeFromPriorityQueue(selectedLead.id);
    }
  };

  const completeCallback = useCallback(async (leadId: string) => {
    const cb = await completeScheduledCallback(leadId);
    if (cb) {
      toast.success('Scheduled callback completed', { duration: 3000 });
      addNotification({ type: 'callback_completed', title: 'Callback Completed', message: `Follow-up with ${cb.leadName} has been completed.`, urgency: 'info', relatedLeadId: leadId, relatedCallbackId: cb.id });
    }
  }, [completeScheduledCallback, addNotification]);

  const handleDispositionSubmit = async (disposition: DispositionType, dispNotes: string, schedule?: ScheduleData) => {
    const targetLead = dispositionLead || selectedLead;
    const targetCallRecordId = dispositionCallRecordId || callRecordId;
    let reportsSyncFailed = false;
    if (targetLead) {
      const resolvedNotes = dispNotes || notes || null;

      addHistoryEntry(targetLead.id, {
        type: 'call',
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        summary: dispNotes,
        agent: 'You',
        disposition,
      });

      // Persist disposition for reports through backend so it still works
      // after callRecordId resets on the client and without relying on client-side call updates.
      const { error: dispositionError } = await supabase.functions.invoke('save-call-disposition', {
        body: {
          leadId: targetLead.id,
          callRecordId: targetCallRecordId,
          disposition,
          notes: resolvedNotes,
        },
      });

      if (dispositionError) {
        reportsSyncFailed = true;
        console.error('Failed to sync disposition to reports:', dispositionError);
      }

      // Sync agent-lead mapping to Back Office (non-blocking)
      supabase.functions.invoke('sync-calling-agent', {
        body: { leadId: targetLead.id, reason: `disposition_${disposition}` },
      }).then(({ error }) => {
        if (error) console.error('BO sync failed (non-fatal):', error);
      });

      // Update lead status so it leaves the queue
      const newStatus = disposition === 'converted' ? 'converted'
        : disposition === 'not_interested' ? 'not_interested'
        : disposition === 'callback' ? 'callback'
        : 'contacted';

      await supabase.from('leads').update({
        status: newStatus as any,
        last_called_at: new Date().toISOString(),
      }).eq('id', targetLead.id);

      autoContactedLeadRef.current = null;
      await refetchQueue();

      if (activeCallbackLeadRef.current === targetLead.id) {
        completeCallback(targetLead.id);
        activeCallbackLeadRef.current = null;
      }

      if (schedule) {
        const scheduledAt = schedule.date instanceof Date
          ? new Date(schedule.date.setHours(parseInt(schedule.timeSlot.split(':')[0] || '9'), parseInt(schedule.timeSlot.split(':')[1] || '0')))
          : new Date();
        await addScheduledCallback({
          leadId: targetLead.id,
          leadName: targetLead.username,
          disposition,
          scheduledAt,
          reason: schedule.reason,
          status: 'pending',
        });
        toast.success('Callback scheduled and added to Priority Queue');
      }
    }

    if (reportsSyncFailed) {
      toast.error('Disposition was applied, but it could not be synced to reports. Please try again.');
    } else {
      toast.success(`Disposition saved: ${disposition}`);
    }

    setShowDisposition(false);
    setDispositionLead(null);
    setDispositionCallRecordId(null);
    setNotes('');
  };

  const handlePrioritySelect = useCallback(async (leadId: string) => {
    isPrioritySelectionRef.current = true;
    const lead = queueLeads.find(l => l.id === leadId);
    if (lead) {
      setSelectedLead(lead);
      activeCallbackLeadRef.current = leadId;
      return;
    }
    // Lead might not be in the queue list (e.g. hot lead on a different page) — fetch from DB
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
    if (data) {
      setSelectedLead(data as unknown as Lead);
      activeCallbackLeadRef.current = leadId;
    } else {
      toast.error('Could not load lead details');
      isPrioritySelectionRef.current = false;
    }
  }, [queueLeads]);

  const handlePriorityCall = useCallback(async (leadId: string) => {
    if (!isSoftphoneReady) {
      toast.error('Voicelay softphone is still connecting. Wait for Connected status, then retry.');
      return;
    }
    // Select the lead first
    await handlePrioritySelect(leadId);
    // Fetch phone number and initiate call
    const { data: phoneData } = await supabase
      .from('leads')
      .select('phone_number')
      .eq('id', leadId)
      .single();
    if (!phoneData?.phone_number) {
      toast.error('No phone number found for this lead');
      return;
    }
    callTargetLeadIdRef.current = leadId;
    const sessionId = await initiateCall(phoneData.phone_number, leadId, 'priority');
    if (!sessionId) {
      callTargetLeadIdRef.current = null;
      return;
    }
    // Mark lead as contacted
    const { error } = await supabase
      .from('leads')
      .update({
        status: 'contacted' as any,
        last_called_at: new Date().toISOString(),
      })
      .eq('id', leadId);
    if (!error) {
      await refetchQueue();
      refreshHotLeads();
      removeFromPriorityQueue(leadId);
      toast.success('Priority call started — lead moved out of queue');
    }
  }, [isSoftphoneReady, handlePrioritySelect, initiateCall, refetchQueue, refreshHotLeads, removeFromPriorityQueue]);

  const handlePriorityDismiss = useCallback(async (itemId: string, leadId: string) => {
    await dismissScheduledItem(itemId, leadId);
    toast.success('Removed from priority queue');
  }, [dismissScheduledItem]);

  const handleReassign = (newLanguage: string, _reason: string) => {
    toast.success(`Lead reassigned to ${newLanguage}-speaking agent. You'll receive 25% commission on conversion.`);
    setShowReassign(false);
  };


  return (
    <>
      <div className="flex flex-col h-[calc(100vh-8rem)] -mt-2 gap-3">
        {/* Incoming Call Panel — overlays when inbound call detected */}
        {incomingCall.isActive && (
          <IncomingCallPanel
            callerNumber={incomingCall.callerNumber}
            callState={incomingCall.callState}
            callDuration={incomingCall.callDuration}
            callRecordId={incomingCall.callRecordId}
            onDismiss={dismissIncomingCall}
          />
        )}

        {/* Calling Mode Selector */}
        <div className="flex items-center justify-between">
          <CallingModeSelector mode={callingMode} onChange={setCallingMode} />
        </div>

        {callingMode === 'queue' ? (
          <div className="flex-1 min-h-0 overflow-auto">
            <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
              <QueueCallingMode />
            </Suspense>
          </div>
        ) : callingMode === 'campaign' ? (
          <div className="flex-1 min-h-0 overflow-auto">
            <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
              <CampaignCallingMode />
            </Suspense>
          </div>
        ) : callingMode === 'incoming' ? (
          <div className="flex-1 min-h-0 overflow-auto">
            <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
              <IncomingCallsMode />
            </Suspense>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 gap-3">
            <LeadQueue leads={queueLeads} selectedId={selectedLead?.id ?? null} onSelect={(lead) => { isPrioritySelectionRef.current = false; setSelectedLead(lead); }} activeQueueLeadId={activeQueueLeadId} />

            <PriorityQueue
              callbacks={scheduledCallbacks}
              selectedLeadId={selectedLead?.id ?? null}
              onSelect={handlePrioritySelect}
              onCall={handlePriorityCall}
              onDismiss={handlePriorityDismiss}
            />

            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <div className="rounded-lg border bg-card shadow-sm min-w-0 overflow-hidden">
                  {selectedLead ? (
                    <div className="flex h-full flex-col">
                      <div className="border-b px-5 py-4">
                        <h3 className="text-lg font-semibold font-mono">{selectedLead.username}</h3>
                        <p className="text-sm text-muted-foreground">Actions for the selected lead — Voicelay is the only live dialer.</p>
                      </div>

                      <div className="flex flex-1 flex-col gap-4 p-5">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-md border bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p className="text-sm font-medium font-mono">{leadPhoneNumber ? maskPhone(leadPhoneNumber) : 'Loading…'}</p>
                          </div>
                          <div className="rounded-md border bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground">Language</p>
                            <p className="text-sm font-medium">{selectedLead.language}</p>
                          </div>
                          <div className="rounded-md border bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground">State</p>
                            <p className="text-sm font-medium">{selectedLead.state}</p>
                          </div>
                          <div className="rounded-md border bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground">Registered</p>
                            <p className="text-sm font-medium">
                              {new Date(selectedLead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        {callState === 'failed' && lastError && (
                          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3">
                            <p className="text-sm text-destructive">{lastError}</p>
                          </div>
                        )}

                        <div className="rounded-md border bg-muted/30 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Calling status</p>
                              <p className="text-sm font-medium">{CALL_STATE_LABELS[callState]}</p>
                              <p className="text-xs text-muted-foreground">
                                {isActive
                                  ? 'Use the Voicelay panel for all live call controls.'
                                  : !isSoftphoneReady
                                  ? 'Voicelay softphone is still connecting — wait for Connected status before starting a call.'
                                  : 'Start the call here, then continue fully inside Voicelay.'}
                              </p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                              <div>
                                <p className="text-xs text-muted-foreground">Elapsed</p>
                                <p className="text-sm font-mono font-medium">{formatElapsed(callDuration)}</p>
                              </div>
                              {isActive && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    endCall();
                                    toast.info('Call marked as ended');
                                  }}
                                >
                                  Mark Call Ended
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Queue calling status bar */}
                        {isQueueActive && (
                          <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 p-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                                Queue Calling Active
                                {countdown !== null && ` — next call in ${countdown}s`}
                              </p>
                              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                {queueLeads.length} lead{queueLeads.length !== 1 ? 's' : ''} remaining
                              </p>
                            </div>
                            <Button variant="destructive" size="sm" onClick={stopQueue}>
                              <StopCircle className="mr-1.5 h-4 w-4" /> End Queue
                            </Button>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {!isQueueActive ? (
                            <>
                              <Button
                                onClick={handleStartCall}
                                disabled={isInitiating || isActive || !leadPhoneNumber || !isSoftphoneReady}
                              >
                                {isInitiating ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting…
                                  </>
                                ) : !isSoftphoneReady ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Softphone connecting…
                                  </>
                                ) : (
                                  <>
                                    <Phone className="mr-2 h-4 w-4" /> Call via Voicelay
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => startQueue(selectedLead?.id)}
                                disabled={queueLeads.length === 0 || isActive || !isSoftphoneReady}
                                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                              >
                                <PlayCircle className="mr-2 h-4 w-4" /> Start Queue Calling
                              </Button>
                            </>
                          ) : null}
                          <Button variant="outline" onClick={() => {
                            setDispositionLead(lastCalledLeadRef.current || selectedLead);
                            setDispositionDuration(callDuration);
                            setDispositionCallRecordId(callRecordId);
                            setShowDisposition(true);
                          }}>
                            Add Disposition (Optional)
                          </Button>
                          <Button variant="outline" onClick={() => setShowScript(v => !v)}>
                            {showScript ? 'Hide Script' : 'Show Script'}
                          </Button>
                          <Button variant="outline" onClick={() => setShowReassign(true)}>
                            <ArrowRightLeft className="mr-2 h-4 w-4" /> Reassign
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowWhatsApp(true)}
                            className="border-success/30 text-success hover:bg-success/10"
                          >
                            <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowWhatsAppLink(true)}
                            className="border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <Link className="mr-2 h-4 w-4" /> Send Link
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowSms(true)}
                            className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                          >
                            <MessageCircle className="mr-2 h-4 w-4" /> SMS
                          </Button>
                        </div>

                        {!leadPhoneNumber && (
                          <p className="text-xs text-destructive">No phone number available for this user.</p>
                        )}

                        {showScript && <CallScriptPanel leadName={selectedLead.username} />}

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Notes</p>
                          <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder={`Call notes... e.g. "${noteExamples[Math.floor(Date.now() / 60000) % noteExamples.length]}"`}
                            className="h-24 w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
                      <Phone className="h-10 w-10 text-muted-foreground/30" />
                      <p className="mt-3 font-medium text-muted-foreground">Select a user from the queue</p>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Pick a lead first, then start the call through the Voicelay panel.
                      </p>
                    </div>
                  )}
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                <LeadHistoryPanel lead={selectedLead} />
              </div>
            </div>
          </div>
        )}
      </div>

      <DispositionModal
        open={showDisposition}
        leadName={(dispositionLead || selectedLead)?.username || ''}
        callDuration={dispositionDuration || callDuration}
        onSubmit={handleDispositionSubmit}
        onClose={() => { setShowDisposition(false); setDispositionLead(null); setDispositionCallRecordId(null); }}
      />

      <LanguageReassignModal
        open={showReassign}
        leadName={selectedLead?.username || ''}
        leadId={selectedLead?.id}
        currentLanguage={selectedLead?.language || ''}
        onReassign={handleReassign}
        onClose={() => setShowReassign(false)}
      />

      {selectedLead && (
        <>
          <WhatsAppMessageModal
            open={showWhatsApp}
            onClose={() => setShowWhatsApp(false)}
            leadId={selectedLead.id}
            leadName={selectedLead.username}
            maskedPhone={maskPhone(leadPhoneNumber || '')}
          />
          <WhatsAppLinkModal
            open={showWhatsAppLink}
            onClose={() => setShowWhatsAppLink(false)}
            leadId={selectedLead.id}
            leadName={selectedLead.username}
            maskedPhone={maskPhone(leadPhoneNumber || '')}
          />
          <SmsMessageModal
            open={showSms}
            onClose={() => setShowSms(false)}
            leadId={selectedLead.id}
            leadName={selectedLead.username}
            maskedPhone={maskPhone(leadPhoneNumber || '')}
          />
        </>
      )}
    </>
  );
}
