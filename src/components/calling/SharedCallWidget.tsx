import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Phone, PhoneOff, PhoneForwarded, Mic, MicOff,
  Pause, Play, ArrowRightLeft, Hash, Delete, Volume2, VolumeX, MessageSquare, Link
} from 'lucide-react';
import { CallScriptPanel } from '@/components/workspace/CallScriptPanel';
import type { VoicelayCallState } from '@/hooks/useVoicelay';
import { useAgentCalling } from '@/contexts/AgentCallingContext';
import { cn } from '@/lib/utils';
import { maskPhone } from '@/lib/maskPhone';
import { WhatsAppMessageModal } from '@/components/calling/WhatsAppMessageModal';
import { WhatsAppLinkModal } from '@/components/calling/WhatsAppLinkModal';
import { SmsMessageModal } from '@/components/calling/SmsMessageModal';

interface SharedCallWidgetProps {
  leadName: string;
  leadPhone?: string;
  leadLanguage?: string;
  leadState?: string;
  leadScore?: number;
  potentialCommission?: number;
  agentPhone?: string;
  leadId?: string;
  callMode?: string;
  onCallStart: () => void;
  onCallEnd: (duration: number) => void;
  onReassign?: () => void;
  scriptTemplate?: string;
  compact?: boolean;
  autoCall?: boolean;
  onAutoCallHandled?: () => void;
}

const DIAL_PAD = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

const stateColors: Record<VoicelayCallState, string> = {
  idle: 'text-muted-foreground',
  initiating: 'text-warning animate-pulse',
  ringing: 'text-info animate-pulse',
  connected: 'text-success',
  on_hold: 'text-warning',
  ended: 'text-muted-foreground',
  failed: 'text-destructive',
  completed: 'text-muted-foreground',
  missed: 'text-destructive',
};

const stateLabels: Record<VoicelayCallState, string> = {
  idle: 'Ready',
  initiating: 'Connecting...',
  ringing: 'Ringing...',
  connected: '● Connected',
  on_hold: '⏸ On Hold',
  ended: 'Call Ended',
  failed: '✕ Failed',
  completed: 'Call Completed',
  missed: 'Missed',
};

export function SharedCallWidget({
  leadName,
  leadPhone = '',
  leadLanguage,
  leadState,
  leadScore,
  potentialCommission,
  agentPhone = '',
  leadId,
  callMode = 'manual',
  onCallStart,
  onCallEnd,
  onReassign,
  compact = false,
  autoCall = false,
  onAutoCallHandled,
}: SharedCallWidgetProps) {
  const [dialInput, setDialInput] = useState(leadPhone);
  const [showDialPad, setShowDialPad] = useState(!leadPhone);
  const [showScript, setShowScript] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showWhatsAppLink, setShowWhatsAppLink] = useState(false);
  const [showSms, setShowSms] = useState(false);
  const completedCallKeyRef = useRef<string | null>(null);
  const maskedNumber = maskPhone(leadPhone);

  const {
    callState,
    callDuration,
    isMuted,
    isOnHold,
    initiateCall,
    endCall,
    toggleMute,
    toggleHold,
    formatDuration,
    isActive,
    isSoftphoneReady,
    lastCompletedCall,
    clearLastCompletedCall,
  } = useAgentCalling();

  useEffect(() => {
    setDialInput(leadPhone);
    setShowDialPad(!leadPhone);
  }, [leadPhone]);

  useEffect(() => {
    if (!lastCompletedCall) return;

    const matchesCurrentWidget = leadId
      ? lastCompletedCall.leadId === leadId
      : !lastCompletedCall.leadId && lastCompletedCall.callMode === callMode;

    if (!matchesCurrentWidget) return;

    const completedCallKey = `${lastCompletedCall.callRecordId ?? 'call'}:${lastCompletedCall.completedAt}`;
    if (completedCallKeyRef.current === completedCallKey) return;

    completedCallKeyRef.current = completedCallKey;
    onCallEnd(lastCompletedCall.duration);
    clearLastCompletedCall();
  }, [callMode, clearLastCompletedCall, lastCompletedCall, leadId, onCallEnd]);

  const handleDialPadPress = (digit: string) => {
    setDialInput(prev => prev + digit);
  };

  const handleBackspace = () => {
    setDialInput(prev => prev.slice(0, -1));
  };

  const handleStartCall = useCallback(async () => {
    const numberToCall = dialInput || leadPhone;
    if (!numberToCall || !isSoftphoneReady) return null;

    onCallStart();
    completedCallKeyRef.current = null;
    return await initiateCall(numberToCall, leadId, callMode);
  }, [callMode, dialInput, initiateCall, isSoftphoneReady, leadId, leadPhone, onCallStart]);

  // Auto-initiate call when autoCall is true
  useEffect(() => {
    if (!autoCall || !leadPhone || callState !== 'idle' || !isSoftphoneReady) return;

    let cancelled = false;

    void (async () => {
      const sessionId = await handleStartCall();
      if (!cancelled && sessionId) {
        onAutoCallHandled?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoCall, callState, handleStartCall, isSoftphoneReady, leadPhone, onAutoCallHandled]);

  const handleEndCall = () => {
    endCall();
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto">
      {/* Lead info header */}
      {!compact && leadName && (
        <div className="text-center space-y-1 mb-4 w-full">
          <h3 className="text-lg font-semibold">{leadName}</h3>
          <p className="text-sm text-muted-foreground">
            {[leadState, leadLanguage, leadScore && `Score: ${leadScore}`].filter(Boolean).join(' · ')}
          </p>
          {potentialCommission != null && (
            <p className="text-xl font-bold text-earning">₹{potentialCommission}</p>
          )}
        </div>
      )}

      {/* Call status display */}
      {isActive && (
        <div className="text-center space-y-2 mb-4">
          <div className="text-4xl font-mono font-bold tabular-nums tracking-wider">
            {formatDuration(callDuration)}
          </div>
          <Badge variant="outline" className={cn('text-xs font-medium', stateColors[callState])}>
            {stateLabels[callState]}
          </Badge>
          {leadPhone && (
            <p className="text-sm text-muted-foreground font-mono">{maskedNumber}</p>
          )}
        </div>
      )}

      {/* Dial input */}
      {!isActive && (
        <div className="w-full mb-3">
          <div className="relative">
            <Input
              value={dialInput}
              onChange={e => setDialInput(e.target.value.replace(/[^0-9+*#]/g, ''))}
              placeholder="Enter phone number..."
              className="text-center text-xl font-mono h-14 pr-10 tracking-wider"
            />
            {dialInput && (
              <button
                onClick={handleBackspace}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Delete className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dial pad */}
      {!isActive && showDialPad && (
        <div className="grid grid-cols-3 gap-2 w-full mb-4">
          {DIAL_PAD.map(({ digit, letters }) => (
            <button
              key={digit}
              onClick={() => handleDialPadPress(digit)}
              className="flex flex-col items-center justify-center h-14 rounded-xl border border-border bg-card hover:bg-accent transition-all active:scale-95"
            >
              <span className="text-xl font-semibold leading-none">{digit}</span>
              {letters && (
                <span className="text-[9px] text-muted-foreground tracking-widest mt-0.5">{letters}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Toggle dial pad */}
      {!isActive && (
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDialPad(!showDialPad)}
            className="text-xs text-muted-foreground"
          >
            <Hash className="h-3 w-3 mr-1" />
            {showDialPad ? 'Hide Keypad' : 'Show Keypad'}
          </Button>
        </div>
      )}

      {!isActive && !isSoftphoneReady && (
        <p className="mb-4 text-center text-xs text-muted-foreground">
          Softphone connecting — wait for Connected status before starting a call.
        </p>
      )}

      {/* Call / End button */}
      {!isActive ? (
        leadPhone ? (
          <Button
            size="lg"
            className="h-14 px-12 rounded-2xl shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-bold tracking-wide"
            onClick={handleStartCall}
            disabled={!isSoftphoneReady}
          >
            <Phone className="h-6 w-6 mr-3" />
            START CALL
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-16 w-16 rounded-full shadow-lg bg-success hover:bg-success/90 text-success-foreground"
            onClick={handleStartCall}
            disabled={!dialInput || !isSoftphoneReady}
          >
            <Phone className="h-7 w-7" />
          </Button>
        )
      ) : (
        <>
          {/* Active call controls */}
          <div className="grid grid-cols-3 gap-3 w-full mb-4">
            {/* Mute */}
            <button
              onClick={toggleMute}
              className={cn(
                'flex flex-col items-center justify-center h-16 rounded-xl border transition-all',
                isMuted ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-card border-border text-foreground hover:bg-accent'
              )}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              <span className="text-[10px] mt-1">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            {/* Hold */}
            <button
              onClick={toggleHold}
              className={cn(
                'flex flex-col items-center justify-center h-16 rounded-xl border transition-all',
                isOnHold ? 'bg-warning/10 border-warning/30 text-warning' : 'bg-card border-border text-foreground hover:bg-accent'
              )}
            >
              {isOnHold ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              <span className="text-[10px] mt-1">{isOnHold ? 'Resume' : 'Hold'}</span>
            </button>

            {/* Speaker */}
            <button
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              className={cn(
                'flex flex-col items-center justify-center h-16 rounded-xl border transition-all',
                isSpeakerOn ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border text-foreground hover:bg-accent'
              )}
            >
              {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              <span className="text-[10px] mt-1">Speaker</span>
            </button>

            {/* Keypad (DTMF) */}
            <button
              onClick={() => setShowDialPad(!showDialPad)}
              className="flex flex-col items-center justify-center h-16 rounded-xl border bg-card border-border text-foreground hover:bg-accent transition-all"
            >
              <Hash className="h-5 w-5" />
              <span className="text-[10px] mt-1">Keypad</span>
            </button>

            {/* Script */}
            <button
              onClick={() => setShowScript(!showScript)}
              className={cn(
                'flex flex-col items-center justify-center h-16 rounded-xl border transition-all',
                showScript ? 'bg-info/10 border-info/30 text-info' : 'bg-card border-border text-foreground hover:bg-accent'
              )}
            >
              <span className="text-lg">📋</span>
              <span className="text-[10px] mt-1">Script</span>
            </button>

            {/* Transfer/Reassign */}
            {onReassign ? (
              <button
                onClick={onReassign}
                className="flex flex-col items-center justify-center h-16 rounded-xl border bg-card border-border text-foreground hover:bg-accent transition-all"
              >
                <PhoneForwarded className="h-5 w-5" />
                <span className="text-[10px] mt-1">Transfer</span>
              </button>
            ) : (
              <button
                className="flex flex-col items-center justify-center h-16 rounded-xl border bg-card border-border text-foreground hover:bg-accent transition-all"
                onClick={() => setShowDialPad(!showDialPad)}
              >
                <ArrowRightLeft className="h-5 w-5" />
                <span className="text-[10px] mt-1">Forward</span>
              </button>
            )}
          </div>

          {/* DTMF pad during call */}
          {showDialPad && isActive && (
            <div className="grid grid-cols-3 gap-1.5 w-full mb-4">
              {DIAL_PAD.map(({ digit, letters }) => (
                <button
                  key={digit}
                  onClick={() => handleDialPadPress(digit)}
                  className="flex flex-col items-center justify-center h-12 rounded-lg border border-border bg-card hover:bg-accent transition-all active:scale-95"
                >
                  <span className="text-lg font-semibold leading-none">{digit}</span>
                  {letters && <span className="text-[8px] text-muted-foreground">{letters}</span>}
                </button>
              ))}
            </div>
          )}

          {/* WhatsApp & SMS buttons during call */}
          {leadId && (
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWhatsApp(true)}
                className="text-xs gap-1.5 border-success/30 text-success hover:bg-success/10"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSms(true)}
                className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Phone className="h-3.5 w-3.5" />
                SMS
              </Button>
            </div>
          )}

          {/* End call — use the Voicelay softphone window */}
          <p className="text-xs text-muted-foreground text-center mt-2">
            End the call from the Voicelay dialer window →
          </p>
        </>
      )}

      {/* Call script panel */}
      {showScript && isActive && (
        <div className="w-full mt-4">
          <CallScriptPanel leadName={leadName} />
        </div>
      )}

      {/* Help text */}
      {!isActive && !compact && (
        <div className="text-center mt-3 max-w-xs space-y-2">
          <p className="text-xs text-muted-foreground">
            {leadPhone
              ? 'Review the lead details before calling. Call will connect via your Voicelay softphone.'
              : 'Enter a number or use the keypad to dial'}
          </p>
        </div>
      )}

      {/* WhatsApp & SMS buttons — always visible when lead is available */}
      {!isActive && leadId && leadPhone && (
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setShowWhatsApp(true)}
            className="gap-2 border-success/40 text-success hover:bg-success/10 font-medium"
          >
            <MessageSquare className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowSms(true)}
            className="gap-2 border-primary/40 text-primary hover:bg-primary/10 font-medium"
          >
            <Phone className="h-4 w-4" />
            Send SMS
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowWhatsAppLink(true)}
            className="gap-2 border-primary/40 text-primary hover:bg-primary/10 font-medium"
          >
            <Link className="h-4 w-4" />
            Send Link
          </Button>
        </div>
      )}

      {/* WhatsApp & SMS Modals */}
      {leadId && (
        <>
          <WhatsAppMessageModal
            open={showWhatsApp}
            onClose={() => setShowWhatsApp(false)}
            leadId={leadId}
            leadName={leadName}
            maskedPhone={maskedNumber}
          />
          <WhatsAppLinkModal
            open={showWhatsAppLink}
            onClose={() => setShowWhatsAppLink(false)}
            leadId={leadId}
            leadName={leadName}
            maskedPhone={maskedNumber}
          />
          <SmsMessageModal
            open={showSms}
            onClose={() => setShowSms(false)}
            leadId={leadId}
            leadName={leadName}
            maskedPhone={maskedNumber}
          />
        </>
      )}
    </div>
  );
}
