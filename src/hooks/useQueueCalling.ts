import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Lead } from '@/types';

export type QueueCallingStatus = 'idle' | 'active' | 'paused';

const MAX_BUSY_QUEUE_RETRIES = 4;

interface UseQueueCallingOptions {
  leads: Lead[];
  initiateCall: (customerNumber: string, leadId: string, callMode: string) => Promise<string | null>;
  isCallActive: boolean;
  refetchQueue: () => Promise<void>;
  selectedLeadId?: string | null;
  canStartCalls?: boolean;
}

export function useQueueCalling({ leads, initiateCall, isCallActive, refetchQueue, selectedLeadId, canStartCalls = true }: UseQueueCallingOptions) {
  const [status, setStatus] = useState<QueueCallingStatus>('idle');
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const statusRef = useRef(status);
  const activeLeadIdRef = useRef(activeLeadId);
  const leadsRef = useRef(leads);
  const nextCallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitingForEndCallRef = useRef(false);
  const canStartCallsRef = useRef(canStartCalls);
  const isCallActiveRef = useRef(isCallActive);
  const busyRetryCountRef = useRef(0);
  statusRef.current = status;
  activeLeadIdRef.current = activeLeadId;
  leadsRef.current = leads;
  canStartCallsRef.current = canStartCalls;
  isCallActiveRef.current = isCallActive;

  const clearTimers = useCallback(() => {
    if (nextCallTimerRef.current) { clearTimeout(nextCallTimerRef.current); nextCallTimerRef.current = null; }
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    setCountdown(null);
  }, []);

  const pauseQueueBecauseSoftphoneIsNotReady = useCallback(() => {
    clearTimers();
    setStatus('idle');
    setActiveLeadId(null);
    waitingForEndCallRef.current = false;
    toast.error('Voicelay softphone is still connecting. Wait for Connected status, then retry.');
  }, [clearTimers]);

  const markLeadContacted = useCallback(async (lead: Lead) => {
    const { error } = await supabase
      .from('leads')
      .update({
        status: 'contacted',
        last_called_at: new Date().toISOString(),
        total_call_attempts: (lead.total_call_attempts ?? 0) + 1,
      })
      .eq('id', lead.id);
    if (error) console.error('Queue: failed to mark lead contacted', error);
    await refetchQueue();
  }, [refetchQueue]);

  const callNextLead = useCallback(async () => {
    if (statusRef.current !== 'active') return;

    // Guard: don't initiate if a call is still active
    if (isCallActiveRef.current) {
      console.log('[QueueCalling] Call still active — waiting before retry');
      nextCallTimerRef.current = setTimeout(() => callNextLead(), 3000);
      return;
    }

    if (!canStartCallsRef.current) {
      pauseQueueBecauseSoftphoneIsNotReady();
      return;
    }

    const currentLeads = leadsRef.current;
    if (currentLeads.length === 0) {
      toast.success('Queue completed — all leads have been called');
      setStatus('idle');
      setActiveLeadId(null);
      return;
    }

    const nextLead = currentLeads[0];
    setActiveLeadId(nextLead.id);
    waitingForEndCallRef.current = false;

    // Fetch phone number
    const { data: phoneData } = await supabase
      .from('leads')
      .select('phone_number')
      .eq('id', nextLead.id)
      .single();

    if (!phoneData?.phone_number) {
      toast.error(`No phone number for ${nextLead.username} — skipping`);
      await markLeadContacted(nextLead);
      nextCallTimerRef.current = setTimeout(() => callNextLead(), 1000);
      return;
    }

    const sessionId = await initiateCall(phoneData.phone_number, nextLead.id, 'queue');
    if (!sessionId) {
      // Check if failure was because agent is still busy on Voicelay
      // If so, retry after a longer delay instead of stopping the queue
      if (busyRetryCountRef.current < MAX_BUSY_QUEUE_RETRIES) {
        busyRetryCountRef.current++;
        const delay = 15000 * busyRetryCountRef.current; // 15s, 30s, 45s
        console.log(`[QueueCalling] Agent busy — queue retry ${busyRetryCountRef.current}/${MAX_BUSY_QUEUE_RETRIES} in ${delay}ms`);
        toast.info(`Voicelay agent still busy — retrying in ${Math.round(delay / 1000)}s...`);
        setActiveLeadId(null);
        nextCallTimerRef.current = setTimeout(() => callNextLead(), delay);
      } else {
        // Exhausted retries — pause queue
        busyRetryCountRef.current = 0;
        toast.error(`Call failed for ${nextLead.username} — queue paused. Fix the issue and restart.`);
        setStatus('idle');
        setActiveLeadId(null);
        waitingForEndCallRef.current = false;
      }
      return;
    }

    // Call succeeded — reset busy retry counter
    busyRetryCountRef.current = 0;

    // Call initiated successfully — lead stays in queue highlighted green
    console.log('[QueueCalling] Call initiated for', nextLead.username, '— waiting for End Call');
    waitingForEndCallRef.current = true;
  }, [initiateCall, markLeadContacted, pauseQueueBecauseSoftphoneIsNotReady]);

  // When call ends (isCallActive goes from true to false) and queue is active:
  // mark lead contacted (removes from queue), then call next
  const prevCallActiveRef = useRef(isCallActive);
  useEffect(() => {
    const wasActive = prevCallActiveRef.current;
    prevCallActiveRef.current = isCallActive;

    if (wasActive && !isCallActive && statusRef.current === 'active') {
      const calledLeadId = activeLeadIdRef.current;
      if (calledLeadId) {
        const calledLead = leadsRef.current.find(l => l.id === calledLeadId);
        if (calledLead) {
          console.log('[QueueCalling] Call ended — marking lead contacted:', calledLead.username);
          markLeadContacted(calledLead).then(() => {
            setActiveLeadId(null);
            // Wait 15 seconds for Voicelay to release the agent before next call
            nextCallTimerRef.current = setTimeout(() => {
              console.log('[QueueCalling] Calling next lead after cooldown');
              busyRetryCountRef.current = 0;
              callNextLead();
            }, 15000);
          });
        } else {
          setActiveLeadId(null);
          busyRetryCountRef.current = 0;
          nextCallTimerRef.current = setTimeout(() => callNextLead(), 15000);
        }
      }
    }
  }, [isCallActive, callNextLead, markLeadContacted]);

  const startQueue = useCallback((startFromLeadId?: string | null) => {
    if (!canStartCalls) {
      toast.error('Voicelay softphone is still connecting. Wait for Connected status, then retry.');
      return;
    }

    if (leads.length === 0) {
      toast.error('No leads in queue to call');
      return;
    }
    setStatus('active');
    toast.success('Queue calling started — calling leads one by one');

    // Determine starting lead
    const resolvedStartId = startFromLeadId || selectedLeadId;
    if (resolvedStartId) {
      const startIdx = leads.findIndex(l => l.id === resolvedStartId);
      if (startIdx >= 0) {
        // Start from the selected lead
        const startLead = leads[startIdx];
        setActiveLeadId(startLead.id);
        
        // Call the selected lead first
        setTimeout(async () => {
          if (!canStartCallsRef.current) {
            pauseQueueBecauseSoftphoneIsNotReady();
            return;
          }

          const { data: phoneData } = await supabase
            .from('leads')
            .select('phone_number')
            .eq('id', startLead.id)
            .single();

          if (!phoneData?.phone_number) {
            toast.error(`No phone number for ${startLead.username} — skipping`);
            await markLeadContacted(startLead);
            setActiveLeadId(null);
            callNextLead();
            return;
          }

          waitingForEndCallRef.current = false;
          const sessionId = await initiateCall(phoneData.phone_number, startLead.id, 'queue');
          if (!sessionId) {
            // Don't mark lead as contacted — call never happened. Pause queue.
            toast.error(`Call failed for ${startLead.username} — queue paused. Fix the issue and restart.`);
            setStatus('idle');
            setActiveLeadId(null);
            waitingForEndCallRef.current = false;
            return;
          }
          waitingForEndCallRef.current = true;
          console.log('[QueueCalling] Started queue from selected lead:', startLead.username);
        }, 100);
        return;
      }
    }

    // Fallback: start from first lead
    setTimeout(() => callNextLead(), 100);
  }, [canStartCalls, leads, selectedLeadId, callNextLead, initiateCall, markLeadContacted, pauseQueueBecauseSoftphoneIsNotReady]);

  const stopQueue = useCallback(() => {
    clearTimers();
    setStatus('idle');
    setActiveLeadId(null);
    waitingForEndCallRef.current = false;
    toast.info('Queue calling stopped');
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return {
    queueStatus: status,
    activeQueueLeadId: activeLeadId,
    countdown,
    startQueue,
    stopQueue,
    isQueueActive: status === 'active',
  };
}
