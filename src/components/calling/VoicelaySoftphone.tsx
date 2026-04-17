import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const VOICELAY_SSO_BASE = 'https://dialersoftphonev2.voicelay.com/dialer/#!/SSOLogin?token=';
const VOICELAY_LOGOUT_URL = 'https://dialersoftphonev2.voicelay.com/dialer/#!/logout';
const READY_WARMUP_MS = 4000;

export type SoftphoneConnectionState = 'loading' | 'connecting' | 'ready' | 'error';

interface VoicelaySoftphoneProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onConnectionStateChange?: (state: SoftphoneConnectionState) => void;
}

export function VoicelaySoftphone({
  className,
  collapsed = false,
  onToggleCollapse,
  onConnectionStateChange,
}: VoicelaySoftphoneProps) {
  const { user, session, role, isLoading: authLoading } = useAuth();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [isSoftphoneVisible, setIsSoftphoneVisible] = useState(false);
  const [virtualNumber, setVirtualNumber] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [booting, setBooting] = useState(false);
  const [isRegistrationWarm, setIsRegistrationWarm] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ssoTokenRef = useRef<string | null>(null);
  const bootTimeoutRef = useRef<number | null>(null);
  const readyTimeoutRef = useRef<number | null>(null);

  const clearBootTimeout = useCallback(() => {
    if (bootTimeoutRef.current) {
      window.clearTimeout(bootTimeoutRef.current);
      bootTimeoutRef.current = null;
    }
  }, []);

  const clearReadyTimeout = useCallback(() => {
    if (readyTimeoutRef.current) {
      window.clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }
  }, []);

  const bootSoftphone = useCallback((token: string) => {
    clearBootTimeout();
    clearReadyTimeout();
    ssoTokenRef.current = token;
    setBooting(true);
    setIsRegistrationWarm(false);
    setIsSoftphoneVisible(false);
    setIframeKey((prev) => prev + 1);
    setIframeSrc(VOICELAY_LOGOUT_URL);

    bootTimeoutRef.current = window.setTimeout(() => {
      setIframeKey((prev) => prev + 1);
      setIframeSrc(`${VOICELAY_SSO_BASE}${token}&_t=${Date.now()}`);
      bootTimeoutRef.current = null;
    }, 2500);
  }, [clearBootTimeout, clearReadyTimeout]);

  const handleIframeLoad = useCallback(() => {
    if (!iframeSrc?.startsWith(VOICELAY_SSO_BASE)) return;

    setIsSoftphoneVisible(true);
    setBooting(false);
    setIsRegistrationWarm(false);
    clearReadyTimeout();

    readyTimeoutRef.current = window.setTimeout(() => {
      setIsRegistrationWarm(true);
      readyTimeoutRef.current = null;
    }, READY_WARMUP_MS);
  }, [clearReadyTimeout, iframeSrc]);

  const connectionState: SoftphoneConnectionState = error
    ? 'error'
    : authLoading || loading || !iframeSrc
      ? 'loading'
      : booting || !isSoftphoneVisible || !isRegistrationWarm
        ? 'connecting'
        : 'ready';

  const isSoftphoneReady = connectionState === 'ready';

  useEffect(() => {
    onConnectionStateChange?.(connectionState);
  }, [connectionState, onConnectionStateChange]);

  useEffect(() => {
    const fetchVoicelayConfig = async () => {
      if (authLoading) return;

      if (!session || !user?.id || role !== 'agent') {
        clearBootTimeout();
        clearReadyTimeout();
        ssoTokenRef.current = null;
        setIframeSrc(null);
        setIsSoftphoneVisible(false);
        setVirtualNumber(null);
        setAgentName('');
        setError(null);
        setBooting(false);
        setIsRegistrationWarm(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setIsRegistrationWarm(false);

      const { data, error: err } = await supabase
        .from('agents')
        .select('voicelay_sso_token, voicelay_virtual_number, voicelay_username, full_name')
        .eq('user_id', user.id)
        .single();

      if (err || !data) {
        clearReadyTimeout();
        setError('No agent profile found');
        setIframeSrc(null);
        setIsSoftphoneVisible(false);
        setIsRegistrationWarm(false);
        setLoading(false);
        return;
      }

      if (!data.voicelay_sso_token) {
        clearReadyTimeout();
        setError('No Voicelay softphone configured for this agent');
        setIframeSrc(null);
        setIsSoftphoneVisible(false);
        setIsRegistrationWarm(false);
        setLoading(false);
        return;
      }

      setVirtualNumber(data.voicelay_virtual_number);
      setAgentName(data.full_name || data.voicelay_username || '');
      setLoading(false);
      bootSoftphone(data.voicelay_sso_token);
    };

    void fetchVoicelayConfig();

    return () => {
      clearBootTimeout();
      clearReadyTimeout();
    };
  }, [authLoading, bootSoftphone, clearBootTimeout, clearReadyTimeout, role, session, user?.id]);

  useEffect(() => {
    const handleUnload = () => {
      if (iframeRef.current) {
        try {
          iframeRef.current.src = VOICELAY_LOGOUT_URL;
        } catch {
          // no-op
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      clearBootTimeout();
      clearReadyTimeout();
      if (iframeRef.current) {
        try {
          iframeRef.current.src = VOICELAY_LOGOUT_URL;
        } catch {
          // no-op
        }
      }
    };
  }, [clearBootTimeout, clearReadyTimeout]);

  const handleReload = () => {
    if (!ssoTokenRef.current) return;
    setError(null);
    bootSoftphone(ssoTokenRef.current);
  };

  if ((authLoading || loading) && !iframeSrc) {
    return (
      <div className={cn('flex items-center justify-center rounded-lg border bg-card p-4', className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading softphone...
        </div>
      </div>
    );
  }

  if (error || !iframeSrc) {
    return (
      <div className={cn('flex flex-col items-center justify-center rounded-lg border bg-card p-4 gap-2', className)}>
        <PhoneOff className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-center">{error || 'Softphone not available'}</p>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className={cn('relative rounded-lg border bg-card p-2', className)}>
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
        >
          <div className="h-6 w-6 rounded-full bg-success/10 flex items-center justify-center">
            <Phone className="h-3 w-3 text-success" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{isSoftphoneReady ? 'Softphone Active' : 'Connecting Softphone'}</p>
            <p className="text-[10px] text-muted-foreground truncate">{virtualNumber || agentName}</p>
          </div>
          <Maximize2 className="h-3 w-3 text-muted-foreground" />
        </button>

        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={iframeSrc}
          className="absolute -left-[9999px] top-0 h-px w-px opacity-0 pointer-events-none"
          allow="microphone; autoplay; clipboard-write"
          onLoad={handleIframeLoad}
          title="Voicelay Softphone Hidden"
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col rounded-lg border bg-card shadow-sm overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center">
            <Phone className="h-3 w-3 text-success" />
          </div>
          <div>
            <p className="text-xs font-medium">Voicelay Softphone</p>
            {virtualNumber && (
              <p className="text-[10px] text-muted-foreground font-mono">{virtualNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px] text-success border-success/30">
            {isSoftphoneReady ? 'Connected' : 'Connecting'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleReload}
            title="Reload softphone"
            disabled={!ssoTokenRef.current || booting}
          >
            <RefreshCw className={cn('h-3 w-3', booting && 'animate-spin')} />
          </Button>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleCollapse}
              title="Minimize"
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={iframeSrc}
          className={cn(
            'border-0',
            isSoftphoneVisible
              ? 'w-full h-full'
              : 'absolute -left-[9999px] top-0 h-px w-px opacity-0 pointer-events-none'
          )}
          style={{ minHeight: '500px' }}
          allow="microphone; autoplay; clipboard-write"
          onLoad={handleIframeLoad}
          title="Voicelay Softphone"
        />
        {!isSoftphoneReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/90">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {isSoftphoneVisible ? 'Waiting for WebRTC registration...' : 'Connecting softphone...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
