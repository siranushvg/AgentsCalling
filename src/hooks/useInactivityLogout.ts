import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_SYNC_INTERVAL_MS = 60 * 1000; // Sync to DB every 60s

const TRACKED_EVENTS: (keyof DocumentEventMap)[] = [
  'mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'input'
];

export function useInactivityLogout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const lastActivityRef = useRef(Date.now());
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isOnCallRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const onCallKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setOnCall = useCallback((onCall: boolean) => {
    isOnCallRef.current = onCall;
    if (onCall) {
      lastActivityRef.current = Date.now();
      // Start a keepalive that continuously resets activity while on a call
      // This prevents logout when agents interact with the Voicelay iframe
      // (iframe events don't bubble to parent document)
      if (!onCallKeepAliveRef.current) {
        onCallKeepAliveRef.current = setInterval(() => {
          if (isOnCallRef.current) {
            lastActivityRef.current = Date.now();
          } else {
            // Call ended, stop keepalive
            if (onCallKeepAliveRef.current) {
              clearInterval(onCallKeepAliveRef.current);
              onCallKeepAliveRef.current = null;
            }
          }
        }, 30_000); // every 30s
      }
    } else {
      // Call ended — clear keepalive
      if (onCallKeepAliveRef.current) {
        clearInterval(onCallKeepAliveRef.current);
        onCallKeepAliveRef.current = null;
      }
    }
  }, []);

  // Use a single stable effect that manages all timers
  useEffect(() => {
    if (!user) return;

    const clearLogoutTimer = () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
    };

    const scheduleLogout = () => {
      clearLogoutTimer();
      logoutTimerRef.current = setTimeout(async () => {
        // Guard: verify actual elapsed time since last activity.
        // Browser tab throttling can fire this timer late/early on refocus.
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed < INACTIVITY_LIMIT_MS) {
          // Not truly inactive — reschedule for remaining time
          logoutTimerRef.current = null;
          scheduleLogout();
          return;
        }

        if (isOnCallRef.current) {
          lastActivityRef.current = Date.now();
          scheduleLogout();
          return;
        }
        const currentUser = userRef.current;
        if (!currentUser) return;
        try { await supabase.rpc('mark_session_timeout', { _user_id: currentUser.id }); } catch {}
        await logoutRef.current();
        navigateRef.current('/login');
      }, INACTIVITY_LIMIT_MS);
    };

    const handleActivity = () => {
      // Throttle: only reset if >5s since last reset
      if (Date.now() - lastActivityRef.current < 5000) return;
      lastActivityRef.current = Date.now();
      scheduleLogout();
    };

    const syncActivity = async () => {
      const currentUser = userRef.current;
      if (!currentUser) return;
      try {
        await supabase.rpc('update_last_activity', { _user_id: currentUser.id });
      } catch {}
    };

    // Initial setup
    scheduleLogout();
    syncActivity();
    syncTimerRef.current = setInterval(syncActivity, ACTIVITY_SYNC_INTERVAL_MS);

    TRACKED_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearLogoutTimer();
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
      if (onCallKeepAliveRef.current) clearInterval(onCallKeepAliveRef.current);
      onCallKeepAliveRef.current = null;
      TRACKED_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [user?.id]); // Only re-run when user identity changes, not on every render

  return { setOnCall };
}
