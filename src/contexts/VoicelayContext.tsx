import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const VOICELAY_SSO_BASE = 'https://dialersoftphonev2.voicelay.com/dialer/#!/SSOLogin?token=';
const VOICELAY_LOGOUT_URL = 'https://dialersoftphonev2.voicelay.com/dialer/#!/logout';
const READY_WARMUP_MS = 6000;
const VOICELAY_OWNER_KEY = 'voicelay-softphone-owner';
const VOICELAY_OWNER_HEARTBEAT_MS = 5000;
const VOICELAY_OWNER_STALE_MS = 15000;

interface VoicelayOwnerRecord {
  tabId: string;
  userId: string;
  updatedAt: number;
}

const parseOwnerRecord = (value: string | null): VoicelayOwnerRecord | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<VoicelayOwnerRecord>;
    if (
      typeof parsed.tabId === 'string' &&
      typeof parsed.userId === 'string' &&
      typeof parsed.updatedAt === 'number'
    ) {
      return parsed as VoicelayOwnerRecord;
    }
  } catch {}

  return null;
};

const readOwnerRecord = (userId: string) => {
  if (typeof window === 'undefined') return null;

  const parsed = parseOwnerRecord(window.localStorage.getItem(VOICELAY_OWNER_KEY));
  if (!parsed || parsed.userId !== userId) return null;

  if (Date.now() - parsed.updatedAt > VOICELAY_OWNER_STALE_MS) {
    window.localStorage.removeItem(VOICELAY_OWNER_KEY);
    return null;
  }

  return parsed;
};

const writeOwnerRecord = (record: VoicelayOwnerRecord) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VOICELAY_OWNER_KEY, JSON.stringify(record));
};

export type SoftphoneConnectionState = 'loading' | 'connecting' | 'ready' | 'error';

interface VoicelayContextValue {
  connectionState: SoftphoneConnectionState;
  isSoftphoneReady: boolean;
  hasIframeSrc: boolean;
  virtualNumber: string | null;
  agentName: string;
  error: string | null;
  booting: boolean;
  handleReload: () => void;
  attachSoftphoneHost: (host: HTMLDivElement | null) => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

const VoicelayContext = createContext<VoicelayContextValue | null>(null);

export function useVoicelay() {
  const ctx = useContext(VoicelayContext);
  if (!ctx) throw new Error('useVoicelay must be used within VoicelayProvider');
  return ctx;
}

export function VoicelayProvider({ children }: { children: React.ReactNode }) {
  const { user, session, role, isLoading: authLoading } = useAuth();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [isSoftphoneVisible, setIsSoftphoneVisible] = useState(false);
  const [virtualNumber, setVirtualNumber] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [booting, setBooting] = useState(false);
  const [isRegistrationWarm, setIsRegistrationWarm] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const ssoTokenRef = useRef<string | null>(null);
  const bootTimeoutRef = useRef<number | null>(null);
  const readyTimeoutRef = useRef<number | null>(null);
  const renderHostRef = useRef<HTMLDivElement | null>(null);
  const parkingHostRef = useRef<HTMLDivElement | null>(null);
  const portalMountRef = useRef<HTMLDivElement | null>(null);
  const [isPortalReady, setIsPortalReady] = useState(false);
  const warmupDoneRef = useRef(false);
  // Track whether we've already booted for this user to prevent re-boots
  const bootedForUserRef = useRef<string | null>(null);
  const tabIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `voicelay-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const ownershipHeartbeatRef = useRef<number | null>(null);
  const ownedUserIdRef = useRef<string | null>(null);
  const [isOwnerTab, setIsOwnerTab] = useState(true);

  const clearOwnershipHeartbeat = useCallback(() => {
    if (ownershipHeartbeatRef.current) {
      window.clearInterval(ownershipHeartbeatRef.current);
      ownershipHeartbeatRef.current = null;
    }
  }, []);

  const releaseSoftphoneOwnership = useCallback((userId?: string | null) => {
    clearOwnershipHeartbeat();

    const targetUserId = userId ?? ownedUserIdRef.current;
    if (!targetUserId || typeof window === 'undefined') {
      ownedUserIdRef.current = null;
      return;
    }

    const currentOwner = readOwnerRecord(targetUserId);
    if (currentOwner?.tabId === tabIdRef.current) {
      window.localStorage.removeItem(VOICELAY_OWNER_KEY);
    }

    if (ownedUserIdRef.current === targetUserId) {
      ownedUserIdRef.current = null;
    }
  }, [clearOwnershipHeartbeat]);

  const claimSoftphoneOwnership = useCallback((userId: string) => {
    const currentOwner = readOwnerRecord(userId);
    if (currentOwner && currentOwner.tabId !== tabIdRef.current) {
      clearOwnershipHeartbeat();
      ownedUserIdRef.current = null;
      setIsOwnerTab(false);
      return false;
    }

    const writeHeartbeat = () => {
      ownedUserIdRef.current = userId;
      writeOwnerRecord({
        tabId: tabIdRef.current,
        userId,
        updatedAt: Date.now(),
      });
    };

    writeHeartbeat();
    clearOwnershipHeartbeat();
    setIsOwnerTab(true);

    ownershipHeartbeatRef.current = window.setInterval(() => {
      const latestOwner = readOwnerRecord(userId);
      if (latestOwner && latestOwner.tabId !== tabIdRef.current) {
        clearOwnershipHeartbeat();
        ownedUserIdRef.current = null;
        setIsOwnerTab(false);
        return;
      }

      writeHeartbeat();
    }, VOICELAY_OWNER_HEARTBEAT_MS);

    return true;
  }, [clearOwnershipHeartbeat]);

  const syncPortalHost = useCallback(() => {
    const portalMount = portalMountRef.current;
    const nextHost = renderHostRef.current ?? parkingHostRef.current;

    if (!portalMount || !nextHost || portalMount.parentElement === nextHost) return;
    nextHost.appendChild(portalMount);
  }, []);

  const attachSoftphoneHost = useCallback((host: HTMLDivElement | null) => {
    renderHostRef.current = host;
    syncPortalHost();
  }, [syncPortalHost]);

  useEffect(() => {
    const portalMount = document.createElement('div');
    portalMount.className = 'relative h-full w-full overflow-hidden';
    portalMountRef.current = portalMount;

    const parkingHost = document.createElement('div');
    parkingHost.className = 'fixed -left-[9999px] top-0 h-[560px] w-[340px] overflow-hidden opacity-0 pointer-events-none';
    parkingHostRef.current = parkingHost;
    document.body.appendChild(parkingHost);

    syncPortalHost();
    setIsPortalReady(true);

    return () => {
      if (portalMount.parentNode) {
        portalMount.parentNode.removeChild(portalMount);
      }
      if (parkingHost.parentNode) {
        parkingHost.parentNode.removeChild(parkingHost);
      }
      portalMountRef.current = null;
      parkingHostRef.current = null;
      renderHostRef.current = null;
    };
  }, [syncPortalHost]);

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

  useEffect(() => {
    if (authLoading) return;

    const userId = user?.id;
    const hasSession = Boolean(session);

    if (!hasSession || !userId || role !== 'agent') {
      releaseSoftphoneOwnership(userId);
      setIsOwnerTab(true);
      return;
    }

    const syncOwnership = () => {
      const owner = readOwnerRecord(userId);

      if (!owner || owner.tabId === tabIdRef.current) {
        claimSoftphoneOwnership(userId);
        return;
      }

      clearOwnershipHeartbeat();
      setIsOwnerTab(false);
    };

    syncOwnership();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== VOICELAY_OWNER_KEY) return;
      syncOwnership();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncOwnership();
      }
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearOwnershipHeartbeat();
    };
  }, [authLoading, claimSoftphoneOwnership, clearOwnershipHeartbeat, releaseSoftphoneOwnership, role, !!session, user?.id]);

  // Boot softphone — stable ref-based to avoid dep chain issues
  const bootSoftphoneRef = useRef((token: string) => {});
  bootSoftphoneRef.current = (token: string) => {
    clearBootTimeout();
    clearReadyTimeout();
    ssoTokenRef.current = token;
    warmupDoneRef.current = false;
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
  };

  const handleIframeLoad = useCallback(() => {
    if (!iframeSrc?.startsWith(VOICELAY_SSO_BASE)) return;
    setIsSoftphoneVisible(true);
    setBooting(false);
    if (warmupDoneRef.current) return;
    warmupDoneRef.current = true;
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

  // Fetch config & boot on auth — use user.id as sole trigger to prevent re-boots
  useEffect(() => {
    if (authLoading) return;

    const userId = user?.id;
    const currentRole = role;

    if (!session || !userId || currentRole !== 'agent') {
      clearBootTimeout();
      clearReadyTimeout();
      ssoTokenRef.current = null;
      bootedForUserRef.current = null;
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

    if (!isOwnerTab) {
      clearBootTimeout();
      clearReadyTimeout();
      ssoTokenRef.current = null;
      bootedForUserRef.current = null;
      setIframeSrc(null);
      setIsSoftphoneVisible(false);
      setVirtualNumber(null);
      setAgentName('');
      setError('Softphone is already active in another window. Keep the live call in the original tab to avoid disconnects.');
      setBooting(false);
      setIsRegistrationWarm(false);
      setLoading(false);
      return;
    }

    // Don't re-boot if we've already booted for this user
    if (bootedForUserRef.current === userId) return;

    const fetchConfig = async () => {
      setLoading(true);
      setError(null);
      setIsRegistrationWarm(false);

      const { data, error: err } = await supabase
        .from('agents')
        .select('voicelay_sso_token, voicelay_virtual_number, voicelay_username, full_name')
        .eq('user_id', userId)
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
      bootedForUserRef.current = userId;
      bootSoftphoneRef.current(data.voicelay_sso_token);
    };

    void fetchConfig();
    return () => { clearBootTimeout(); clearReadyTimeout(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, role, !!session, isOwnerTab]);

  // Cleanup on page unload
  useEffect(() => {
    const handleUnload = () => {
      releaseSoftphoneOwnership();
      if (iframeRef.current) {
        try { iframeRef.current.src = VOICELAY_LOGOUT_URL; } catch {}
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      clearBootTimeout();
      clearReadyTimeout();
      releaseSoftphoneOwnership();
      if (iframeRef.current) {
        try { iframeRef.current.src = VOICELAY_LOGOUT_URL; } catch {}
      }
    };
  }, [clearBootTimeout, clearReadyTimeout, releaseSoftphoneOwnership]);

  const handleReload = useCallback(() => {
    if (!ssoTokenRef.current) return;
    setError(null);
    bootedForUserRef.current = null; // Allow re-boot
    bootSoftphoneRef.current(ssoTokenRef.current);
  }, []);

  const value: VoicelayContextValue = {
    connectionState,
    isSoftphoneReady: connectionState === 'ready',
    hasIframeSrc: Boolean(iframeSrc),
    virtualNumber,
    agentName,
    error,
    booting,
    handleReload,
    attachSoftphoneHost,
    iframeRef,
  };

  const iframePortal = isPortalReady && portalMountRef.current && iframeSrc
    ? createPortal(
        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={iframeSrc}
          className={isSoftphoneVisible
            ? 'h-full w-full border-0'
            : 'absolute -left-[9999px] top-0 h-px w-px border-0 opacity-0 pointer-events-none'}
          style={isSoftphoneVisible ? { minHeight: '500px' } : undefined}
          allow="microphone; autoplay; clipboard-write"
          onLoad={handleIframeLoad}
          title="Voicelay Persistent Softphone"
        />,
        portalMountRef.current,
      )
    : null;

  return (
    <VoicelayContext.Provider value={value}>
      {children}
      {iframePortal}
    </VoicelayContext.Provider>
  );
}
