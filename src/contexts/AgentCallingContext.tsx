import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Lead } from '@/types';
import { useInactivity } from '@/contexts/InactivityContext';
import { useVoicelay as useSoftphoneConnection } from '@/contexts/VoicelayContext';
import { useLeadQueue } from '@/hooks/useLeadQueue';
import { useQueueCalling } from '@/hooks/useQueueCalling';
import { useVoicelay as useCallRuntime } from '@/hooks/useVoicelay';
import { parseVoicelayMessage } from '@/hooks/voicelayMessageUtils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isActiveCallState, terminalStatus } from '@/lib/callStateMachine';

type VoicelayRuntimeValue = ReturnType<typeof useCallRuntime>;
type QueueCallingValue = ReturnType<typeof useQueueCalling>;

interface CompletedCallSummary {
  leadId: string | null;
  callMode: string | null;
  duration: number;
  callRecordId: string | null;
  completedAt: number;
}

interface IncomingCallState {
  isActive: boolean;
  callerNumber: string | null;
  callState: 'ringing' | 'connected' | 'on_hold' | 'ended';
  callDuration: number;
  callRecordId: string | null;
  startedAt: number | null;
}

interface AgentCallingContextValue extends Omit<VoicelayRuntimeValue, 'initiateCall'>, QueueCallingValue {
  queueLeads: Lead[];
  isQueueLoading: boolean;
  refetchQueue: () => Promise<void>;
  initiateCall: VoicelayRuntimeValue['initiateCall'];
  isSoftphoneReady: boolean;
  activeCallLeadId: string | null;
  activeCallMode: string | null;
  lastCompletedCall: CompletedCallSummary | null;
  clearLastCompletedCall: () => void;
  incomingCall: IncomingCallState;
  dismissIncomingCall: () => void;
}

const AgentCallingContext = createContext<AgentCallingContextValue | null>(null);

const INITIAL_INCOMING: IncomingCallState = {
  isActive: false,
  callerNumber: null,
  callState: 'ringing',
  callDuration: 0,
  callRecordId: null,
  startedAt: null,
};

export function AgentCallingProvider({ children }: { children: React.ReactNode }) {
  const { leads: queueLeads, isLoading: isQueueLoading, refetch: refetchQueue } = useLeadQueue();
  const { isSoftphoneReady } = useSoftphoneConnection();
  const { setOnCall } = useInactivity();
  const { user } = useAuth();
  const [activeCallLeadId, setActiveCallLeadId] = useState<string | null>(null);
  const [activeCallMode, setActiveCallMode] = useState<string | null>(null);
  const [lastCompletedCall, setLastCompletedCall] = useState<CompletedCallSummary | null>(null);
  const activeCallLeadIdRef = useRef<string | null>(null);
  const activeCallModeRef = useRef<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallState>(INITIAL_INCOMING);
  const incomingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const incomingStartRef = useRef<number>(0);
  const inboundCallRecordIdRef = useRef<string | null>(null);
  // Idempotency guard: prevent duplicate inbound call record creation
  const inboundInsertingRef = useRef(false);

  const clearActiveCallMeta = useCallback(() => {
    activeCallLeadIdRef.current = null;
    activeCallModeRef.current = null;
    setActiveCallLeadId(null);
    setActiveCallMode(null);
  }, []);

  const clearLastCompletedCall = useCallback(() => {
    setLastCompletedCall(null);
  }, []);

  const dismissIncomingCall = useCallback(() => {
    if (incomingTimerRef.current) {
      clearInterval(incomingTimerRef.current);
      incomingTimerRef.current = null;
    }
    inboundInsertingRef.current = false;
    setIncomingCall(INITIAL_INCOMING);
  }, []);

  // Listen for incoming call postMessages from Voicelay iframe
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const origin = String(e.origin || '');
      if (!origin.includes('voicelay') && !origin.includes('dialer')) return;

      const parsed = parseVoicelayMessage(e.data);

      if (parsed.isIncoming && parsed.callerNumber) {
        // Don't trigger if we already have an outbound call active
        if (activeCallLeadIdRef.current) return;
        // Don't trigger if inbound already active for this number
        if (inboundInsertingRef.current) return;

        console.log('[AgentCalling] Incoming call detected from:', parsed.callerNumber, 'sessionId:', parsed.sessionId);

        incomingStartRef.current = Date.now();
        inboundCallRecordIdRef.current = null;
        inboundInsertingRef.current = true;

        const inboundSessionId = parsed.sessionId || null;

        setIncomingCall({
          isActive: true,
          callerNumber: parsed.callerNumber,
          callState: 'ringing',
          callDuration: 0,
          callRecordId: null,
          startedAt: Date.now(),
        });

        // Create inbound call record — single insert with idempotency guard
        (async () => {
          try {
            const digits = parsed.callerNumber!.replace(/[^0-9]/g, '');
            const last10 = digits.slice(-10);

            const { data: leadMatch } = await supabase
              .from('leads')
              .select('id, assigned_agent_id')
              .eq('normalized_phone', last10)
              .limit(1)
              .maybeSingle();

            const agentId = leadMatch?.assigned_agent_id
              || (user?.id ? (await supabase.rpc('get_agent_id_for_user', { _user_id: user.id })).data : null);

            if (!agentId) {
              console.warn('[AgentCalling] No agent found for inbound call — skipping DB insert');
              return;
            }

            // Build dedup query — check for existing active inbound call
            let existingQuery = supabase
              .from('calls')
              .select('id')
              .eq('agent_id', agentId)
              .eq('call_mode', 'inbound')
              .in('status', ['ringing', 'connected', 'on_hold'] as any[])
              .limit(1);

            if (leadMatch?.id) {
              existingQuery = existingQuery.eq('lead_id', leadMatch.id);
            }

            const { data: existing } = await existingQuery.maybeSingle();

            if (existing) {
              console.log('[AgentCalling] Inbound call record already exists:', existing.id);
              inboundCallRecordIdRef.current = existing.id;
              // Update session_id if we now have it
              if (inboundSessionId) {
                await supabase.from('calls').update({ session_id: inboundSessionId }).eq('id', existing.id);
              }
              setIncomingCall(prev => prev.isActive ? { ...prev, callRecordId: existing.id } : prev);
            } else {
              const insertPayload: Record<string, unknown> = {
                agent_id: agentId,
                call_mode: 'inbound',
                status: 'ringing' as const,
                duration_seconds: 0,
                started_at: new Date().toISOString(),
                caller_number: parsed.callerNumber,
              };
              if (leadMatch?.id) insertPayload.lead_id = leadMatch.id;
              if (inboundSessionId) insertPayload.session_id = inboundSessionId;

              const { data: callRow, error: insertErr } = await supabase
                .from('calls')
                .insert(insertPayload as any)
                .select('id')
                .single();

              if (insertErr) {
                console.error('[AgentCalling] DB insert failed for inbound call:', insertErr);
              } else if (callRow) {
                inboundCallRecordIdRef.current = callRow.id;
                setIncomingCall(prev => prev.isActive ? { ...prev, callRecordId: callRow.id } : prev);
                console.log('[AgentCalling] Inbound call record created:', callRow.id, 'lead:', leadMatch?.id || 'unknown', 'session:', inboundSessionId);
              }
            }
          } catch (err) {
            console.error('[AgentCalling] Failed to create inbound call record:', err);
          }
        })();

        // Start duration timer
        if (incomingTimerRef.current) clearInterval(incomingTimerRef.current);
        incomingTimerRef.current = setInterval(() => {
          setIncomingCall(prev => ({
            ...prev,
            callDuration: Math.floor((Date.now() - incomingStartRef.current) / 1000),
          }));
        }, 1000);

        // Auto-transition to connected after 3s
        setTimeout(() => {
          setIncomingCall(prev => prev.isActive && prev.callState === 'ringing'
            ? { ...prev, callState: 'connected' }
            : prev
          );
        }, 3000);

        return;
      }

      // Detect incoming call ending via terminal hints
      if (parsed.isTerminal) {
        setIncomingCall(prev => {
          if (!prev.isActive) return prev;
          if (incomingTimerRef.current) {
            clearInterval(incomingTimerRef.current);
            incomingTimerRef.current = null;
          }
          const finalDuration = typeof parsed.duration === 'number' && parsed.duration > 0
            ? parsed.duration : prev.callDuration;

          // Update inbound call record with terminal status + session_id from terminal event
          if (inboundCallRecordIdRef.current) {
            const dbStatus = terminalStatus(finalDuration);
            const updatePayload: Record<string, unknown> = {
              status: dbStatus,
              duration_seconds: finalDuration,
              ended_at: new Date().toISOString(),
            };
            // Attach session_id from terminal event if available (helps webhook match recordings later)
            if (parsed.sessionId) {
              updatePayload.session_id = parsed.sessionId;
            }
            supabase.from('calls').update(updatePayload as any).eq('id', inboundCallRecordIdRef.current).then(({ error }) => {
              if (error) console.error('[AgentCalling] Failed to update inbound call record:', error);
              else console.log(`[AgentCalling] Inbound call updated: ${dbStatus}, duration: ${finalDuration}s, session: ${parsed.sessionId || 'n/a'}`);
            });
          }

          inboundInsertingRef.current = false;
          return { ...prev, callState: 'ended', callDuration: finalDuration };
        });
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [user?.id]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (incomingTimerRef.current) clearInterval(incomingTimerRef.current);
    };
  }, []);

  const voicelay = useCallRuntime({
    onCallEnd: async (duration, _sessionId, callRecordId) => {
      setLastCompletedCall({
        leadId: activeCallLeadIdRef.current,
        callMode: activeCallModeRef.current,
        duration,
        callRecordId: callRecordId ?? null,
        completedAt: Date.now(),
      });
      clearActiveCallMeta();
    },
  });

  const initiateCall = useCallback<VoicelayRuntimeValue['initiateCall']>(
    async (customerNumber, leadId, callMode) => {
      if (!isSoftphoneReady) {
        toast.error('Voicelay softphone is still connecting. Wait for Connected status, then retry.');
        return null;
      }

      // Prevent duplicate active calls
      if (voicelay.isActive) {
        console.warn('[AgentCalling] initiateCall rejected: outbound call already active');
        toast.error('A call is already in progress.');
        return null;
      }

      if (incomingCall.isActive && incomingCall.callState !== 'ended') {
        console.warn('[AgentCalling] initiateCall rejected: inbound call active');
        toast.error('An incoming call is in progress.');
        return null;
      }

      const normalizedLeadId = leadId ?? null;
      const normalizedCallMode = callMode ?? null;

      setLastCompletedCall(null);
      activeCallLeadIdRef.current = normalizedLeadId;
      activeCallModeRef.current = normalizedCallMode;
      setActiveCallLeadId(normalizedLeadId);
      setActiveCallMode(normalizedCallMode);

      const sessionId = await voicelay.initiateCall(customerNumber, leadId, callMode);

      if (!sessionId) {
        clearActiveCallMeta();
      }

      return sessionId;
    },
    [clearActiveCallMeta, isSoftphoneReady, voicelay.initiateCall, voicelay.isActive, incomingCall.isActive, incomingCall.callState],
  );

  const queueCalling = useQueueCalling({
    leads: queueLeads,
    initiateCall,
    isCallActive: voicelay.isActive,
    refetchQueue,
    canStartCalls: isSoftphoneReady,
  });

  useEffect(() => {
    setOnCall(isActiveCallState(voicelay.callState) || incomingCall.isActive);
  }, [setOnCall, voicelay.callState, incomingCall.isActive]);

  return (
    <AgentCallingContext.Provider
      value={{
        queueLeads,
        isQueueLoading,
        refetchQueue,
        isSoftphoneReady,
        ...voicelay,
        initiateCall,
        activeCallLeadId,
        activeCallMode,
        lastCompletedCall,
        clearLastCompletedCall,
        incomingCall,
        dismissIncomingCall,
        ...queueCalling,
      }}
    >
      {children}
    </AgentCallingContext.Provider>
  );
}

export function useAgentCalling() {
  const context = useContext(AgentCallingContext);
  if (!context) {
    throw new Error('useAgentCalling must be used within AgentCallingProvider');
  }
  return context;
}
