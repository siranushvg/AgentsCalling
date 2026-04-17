import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const VOICELAY_SSO_BASE = 'https://dialersoftphonev2.voicelay.com/dialer/#!/SSOLogin?token=';
const VOICELAY_LOGOUT_URL = 'https://dialersoftphonev2.voicelay.com/dialer/#!/logout';

export function GlobalSoftphone() {
  const { user, role } = useAuth();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'logout' | 'sso'>('idle');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ssoTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || role !== 'agent') {
      setPhase('idle');
      setIframeSrc(null);
      return;
    }

    let cancelled = false;

    const boot = async () => {
      const { data } = await supabase
        .from('agents')
        .select('voicelay_sso_token')
        .eq('user_id', user.id)
        .single();

      if (cancelled || !data?.voicelay_sso_token) return;

      ssoTokenRef.current = data.voicelay_sso_token;

      // Phase 1: load logout URL to clear any stale session
      setIframeSrc(VOICELAY_LOGOUT_URL);
      setPhase('logout');

      // Phase 2: after a delay, load the SSO URL
      setTimeout(() => {
        if (cancelled) return;
        const ts = Date.now();
        setIframeSrc(`${VOICELAY_SSO_BASE}${ssoTokenRef.current}&_t=${ts}`);
        setPhase('sso');
      }, 2500);
    };

    boot();

    const handleUnload = () => {
      if (iframeRef.current) {
        try { iframeRef.current.src = VOICELAY_LOGOUT_URL; } catch {}
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', handleUnload);
      if (iframeRef.current) {
        try { iframeRef.current.src = VOICELAY_LOGOUT_URL; } catch {}
      }
    };
  }, [user?.id, role]);

  if (!iframeSrc) return null;

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      className="absolute -left-[9999px] top-0 h-px w-px opacity-0 pointer-events-none"
      allow="microphone; autoplay; clipboard-write"
      title="Voicelay Global Softphone"
    />
  );
}
