import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseVoicelayMessage } from './voicelayMessageUtils';
import {
  type CallState,
  transitionCallState,
  isActiveCallState,
  isTerminalState,
} from '@/lib/callStateMachine';

export type VoicelayCallState = CallState;

interface UseVoicelayOptions {
  onCallStateChange?: (state: VoicelayCallState) => void;
  onCallEnd?: (duration: number, sessionId: string, callRecordId: string | null) => void;
}

const TERMINAL_DB_STATUSES = new Set(['completed', 'missed', 'failed']);
const MAX_BUSY_RETRIES = 2;
const BUSY_RETRY_DELAY_MS = 6000;
const SOFTPHONE_RETRY_DELAYS_MS = [5000, 8000] as const;

const readInvokeErrorPayload = async (invokeError: any) => {
  const response = invokeError?.context;
  if (!response) return null;
  try {
    if (typeof response.clone === 'function') return await response.clone().json();
    if (typeof response.json === 'function') return await response.json();
  } catch {}
  return null;
};

const isBusyInvokePayload = (payload: any) =>
  Number(payload?.providerStatus) === 409 ||
  (typeof payload?.error === 'string' && payload.error.toLowerCase().includes('agent is busy'));

const isSoftphoneRegistrationPayload = (payload: any) => {
  const errorMessage = String(payload?.error ?? '').toLowerCase();
  const providerMessage = String(payload?.details?.message ?? '').toLowerCase();
  const providerDetailStatus = Number(payload?.details?.status ?? -1);
  return (
    errorMessage.includes('softphone is offline') ||
    errorMessage.includes('not registered') ||
    errorMessage.includes('still connecting') ||
    errorMessage.includes('webrtc') ||
    (providerDetailStatus === 0 && providerMessage === 'invalid agent number')
  );
};

export function useVoicelay(options: UseVoicelayOptions = {}) {
  const [callState, setCallStateRaw] = useState<VoicelayCallState>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [callRecordId, setCallRecordId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const initiatingRef = useRef(false);
  const callStateRef = useRef(callState);
  const callDurationRef = useRef(callDuration);
  const sessionIdRef = useRef(sessionId);
  const callRecordIdRef = useRef(callRecordId);
  const optionsRef = useRef(options);

  callStateRef.current = callState;
  callDurationRef.current = callDuration;
  sessionIdRef.current = sessionId;
  callRecordIdRef.current = callRecordId;
  optionsRef.current = options;

  // Strict state transition wrapper
  const setCallState = useCallback((next: VoicelayCallState, context?: string) => {
    setCallStateRaw(prev => {
      const result = transitionCallState(prev, next, context ?? 'useVoicelay');
      if (result === null) return prev; // rejected
      return result;
    });
  }, []);

  // Force-set for reset scenarios (idle after ended)
  const forceCallState = useCallback((next: VoicelayCallState) => {
    console.log(`[useVoicelay] Force state → ${next}`);
    setCallStateRaw(next);
  }, []);

  useEffect(() => {
    if (callState === 'connected' && !isOnHold) {
      startTimeRef.current = Date.now() - callDurationRef.current * 1000;
      timerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [callState, isOnHold]);

  const handleCallEnded = useCallback((durationOverride?: number | null) => {
    const current = callStateRef.current;
    if (current === 'ended' || current === 'idle') return;

    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (resetTimeoutRef.current) { clearTimeout(resetTimeoutRef.current); resetTimeoutRef.current = null; }

    const resolvedDuration = typeof durationOverride === 'number' && Number.isFinite(durationOverride)
      ? durationOverride : callDurationRef.current;

    if (resolvedDuration !== callDurationRef.current) setCallDuration(resolvedDuration);

    console.log(`[useVoicelay] Call ended. Duration: ${resolvedDuration}s, Record: ${callRecordIdRef.current}`);
    setCallState('ended', 'handleCallEnded');
    optionsRef.current.onCallEnd?.(resolvedDuration, sessionIdRef.current || '', callRecordIdRef.current);

    resetTimeoutRef.current = setTimeout(() => {
      forceCallState('idle');
      setSessionId(null);
      setCallRecordId(null);
      setCallDuration(0);
      setLastError(null);
      resetTimeoutRef.current = null;
    }, 500);
  }, [setCallState, forceCallState]);

  // Listen for postMessages from voicelay
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const origin = String(e.origin || '');
      if (!origin.includes('voicelay') && !origin.includes('dialer')) return;

      if (origin.includes('voicelay') || origin.includes('dialer')) {
        console.log('[useVoicelay] postMessage:', JSON.stringify(e.data), 'origin:', origin);
      }

      if (!isActiveCallState(callStateRef.current)) return;

      const { duration, isTerminal, isWeakTerminal, isTransportMessage, normalizedValues } = parseVoicelayMessage(e.data);

      const currentState = callStateRef.current;
      const isCallEstablished = currentState === 'connected' || currentState === 'on_hold';
      const acceptWeakHint = isWeakTerminal && isCallEstablished && !isTransportMessage;

      if (!isTerminal && !acceptWeakHint) return;

      console.log('[useVoicelay] Terminal detected:', normalizedValues, 'weak?', acceptWeakHint);
      handleCallEnded(duration);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [handleCallEnded]);

  // Realtime subscription for call record updates
  useEffect(() => {
    if (!callRecordId || !isActiveCallState(callState)) return;

    const channel = supabase
      .channel(`call-end-${callRecordId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'calls',
        filter: `id=eq.${callRecordId}`,
      }, (payload) => {
        const row = payload.new as { status: string; duration_seconds: number; ended_at: string | null };
        if (row.ended_at || TERMINAL_DB_STATUSES.has(row.status)) {
          console.log('[useVoicelay] Realtime: call ended:', row.status, 'dur:', row.duration_seconds);
          handleCallEnded(row.duration_seconds > 0 ? row.duration_seconds : null);
        }
      })
      .subscribe();

    const fallbackPoll = setInterval(async () => {
      const { data } = await supabase
        .from('calls').select('status, duration_seconds, ended_at')
        .eq('id', callRecordId).maybeSingle();
      if (!data) { handleCallEnded(); return; }
      if (data.ended_at || TERMINAL_DB_STATUSES.has(data.status)) {
        console.log('[useVoicelay] Poll: call ended:', data.status);
        handleCallEnded(data.duration_seconds > 0 ? data.duration_seconds : null);
      }
    }, 8000);

    return () => { supabase.removeChannel(channel); clearInterval(fallbackPoll); };
  }, [callRecordId, callState, handleCallEnded]);

  // Safety timeout: 2h max call
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (safetyTimeoutRef.current) { clearTimeout(safetyTimeoutRef.current); safetyTimeoutRef.current = null; }
    if (isActiveCallState(callState)) {
      safetyTimeoutRef.current = setTimeout(() => {
        console.warn('[useVoicelay] Safety timeout — force reset after 2h');
        handleCallEnded();
      }, 2 * 60 * 60 * 1000);
    }
    return () => { if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current); };
  }, [callState, handleCallEnded]);

  useEffect(() => { optionsRef.current.onCallStateChange?.(callState); }, [callState]);

  useEffect(() => {
    return () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  const initiateCall = useCallback(async (customerNumber: string, leadId?: string, callMode?: string) => {
    if (initiatingRef.current) {
      console.warn('[useVoicelay] initiateCall rejected: already initiating');
      return null;
    }
    if (isActiveCallState(callStateRef.current)) {
      console.warn('[useVoicelay] initiateCall rejected: call already active:', callStateRef.current);
      return null;
    }
    initiatingRef.current = true;

    try {
      if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
      if (resetTimeoutRef.current) { clearTimeout(resetTimeoutRef.current); resetTimeoutRef.current = null; }
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

      setCallState('initiating', 'initiateCall');
      setCallDuration(0);
      setIsMuted(false);
      setIsOnHold(false);
      setLastError(null);

      let data: any = null;
      let error: any = null;
      let busyRetries = 0;
      let softphoneRetries = 0;

      while (true) {
        const result = await supabase.functions.invoke('voicelay-proxy', {
          body: { customerNumber, leadId, callMode: callMode || 'manual' },
        });
        data = result.data ?? (result.error ? await readInvokeErrorPayload(result.error) : null);
        error = result.error;

        if (isBusyInvokePayload(data) && busyRetries < MAX_BUSY_RETRIES) {
          busyRetries++;
          console.log(`[useVoicelay] Agent busy — retry ${busyRetries}/${MAX_BUSY_RETRIES}`);
          await new Promise(r => setTimeout(r, BUSY_RETRY_DELAY_MS));
          continue;
        }

        if (isSoftphoneRegistrationPayload(data) && softphoneRetries < SOFTPHONE_RETRY_DELAYS_MS.length) {
          const delay = SOFTPHONE_RETRY_DELAYS_MS[softphoneRetries];
          softphoneRetries++;
          console.log(`[useVoicelay] Softphone registering — retry ${softphoneRetries}`);
          if (softphoneRetries === 1) toast.info('Softphone is still connecting — retrying automatically...');
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        break;
      }

      if (data?.error) {
        console.error('[useVoicelay] Call error:', data.error);
        setCallState('failed', 'proxy-error');
        setLastError(isBusyInvokePayload(data) ? 'AGENT_BUSY' : data.error);
        if (!isBusyInvokePayload(data)) toast.error(data.error);
        return null as string | null;
      }

      if (error) {
        console.error('[useVoicelay] Proxy error:', error);
        setCallState('failed', 'invoke-error');
        const msg = 'Failed to initiate call. Please try again.';
        setLastError(msg);
        toast.error(msg);
        return null as string | null;
      }

      const sid = data?.sessionId;
      const crid = data?.callRecordId || null;
      setSessionId(sid);
      setCallRecordId(crid);
      setCallState('ringing', 'call-initiated');
      console.log('[useVoicelay] Call created. Session:', sid, 'Record:', crid);
      toast.success('Call initiated — ringing...');

      connectTimeoutRef.current = setTimeout(() => {
        setCallState('connected', 'auto-connect-timeout');
        connectTimeoutRef.current = null;
      }, 3000);

      // Safety: if call stays in ringing/connected for >90s without any
      // webhook or postMessage update, mark it as missed client-side.
      // The reaper DB function is the server-side backstop (runs every 5 min).
      const ringingTimeoutRef = setTimeout(async () => {
        const current = callStateRef.current;
        if (current === 'ringing') {
          console.warn('[useVoicelay] Ringing timeout (90s) — no webhook response, ending call');
          if (crid) {
            await supabase.from('calls').update({
              status: 'missed',
              ended_at: new Date().toISOString(),
              duration_seconds: 0,
            }).eq('id', crid).eq('status', 'ringing');
          }
          handleCallEnded(0);
        }
      }, 90_000);

      return sid;
    } catch (err) {
      console.error('[useVoicelay] Network error:', err);
      setCallState('failed', 'network-error');
      const msg = 'Network error — could not reach dialer service';
      setLastError(msg);
      toast.error(msg);
      return null;
    } finally {
      initiatingRef.current = false;
    }
  }, [setCallState]);

  const endCall = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
    if (resetTimeoutRef.current) { clearTimeout(resetTimeoutRef.current); resetTimeoutRef.current = null; }

    const dur = callDurationRef.current;
    const sid = sessionIdRef.current;
    const crid = callRecordIdRef.current;

    console.log('[useVoicelay] Manual endCall. Duration:', dur);
    setCallStateRaw('ended');
    optionsRef.current.onCallEnd?.(dur, sid || '', crid);

    setTimeout(() => {
      forceCallState('idle');
      setSessionId(null);
      setCallRecordId(null);
      setCallDuration(0);
      setLastError(null);
    }, 300);

    return dur;
  }, [forceCallState]);

  const resetState = useCallback(() => {
    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
    if (resetTimeoutRef.current) { clearTimeout(resetTimeoutRef.current); resetTimeoutRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    initiatingRef.current = false;
    forceCallState('idle');
    setCallDuration(0);
    setSessionId(null);
    setCallRecordId(null);
    setIsMuted(false);
    setIsOnHold(false);
    setLastError(null);
  }, [forceCallState]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    toast.info(isMuted ? 'Microphone unmuted' : 'Microphone muted');
  }, [isMuted]);

  const toggleHold = useCallback(() => {
    setIsOnHold((prev) => !prev);
    setCallStateRaw((prev) => {
      if (prev === 'connected') {
        const result = transitionCallState(prev, 'on_hold', 'toggleHold');
        return result ?? prev;
      }
      if (prev === 'on_hold') {
        const result = transitionCallState(prev, 'connected', 'toggleHold');
        return result ?? prev;
      }
      return prev;
    });
    toast.info(isOnHold ? 'Call resumed' : 'Call on hold');
  }, [isOnHold]);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    callState,
    callDuration,
    sessionId,
    callRecordId,
    isMuted,
    isOnHold,
    lastError,
    initiateCall,
    endCall,
    resetState,
    toggleMute,
    toggleHold,
    formatDuration,
    isActive: isActiveCallState(callState),
    isInitiating: callState === 'initiating',
  };
}
