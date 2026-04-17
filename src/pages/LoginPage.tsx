import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogIn, Eye, EyeOff, Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/** Convert "HH:MM:SS" to total minutes since midnight */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Get current IST time in minutes since midnight */
function nowISTMinutes(): number {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ist.getHours() * 60 + ist.getMinutes();
}

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

type GateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'blocked'; shiftStart: string; message: string }
  | { kind: 'pending'; requestId: string }
  | { kind: 'approved' }
  | { kind: 'rejected'; note: string | null };

type EarlyLoginRequestStatus = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gate, setGate] = useState<GateState>({ kind: 'idle' });
  const [shiftCheckInProgress, setShiftCheckInProgress] = useState(false);

  const getExistingRequest = async (agentId: string, shiftDate: string) => {
    const { data, error } = await supabase
      .from('early_login_requests')
      .select('id, status, review_note')
      .eq('agent_id', agentId)
      .eq('shift_date', shiftDate)
      .maybeSingle();

    return {
      data: (data as EarlyLoginRequestStatus | null) ?? null,
      error,
    };
  };

  useEffect(() => {
    // Don't auto-redirect while we're still doing the shift timing check
    if (authLoading || !isAuthenticated || shiftCheckInProgress) return;
    // Don't redirect if the gate is showing a blocked/pending/rejected state
    if (gate.kind !== 'idle' && gate.kind !== 'checking') return;

    if (role === 'agent') navigate('/agent', { replace: true });
    else if (role === 'team_lead') navigate('/team-lead', { replace: true });
    else if (role === 'admin') navigate('/admin', { replace: true });
    else navigate('/forbidden', { replace: true });
  }, [authLoading, isAuthenticated, navigate, role, shiftCheckInProgress, gate.kind]);

  // Poll for approval when request is pending
  useEffect(() => {
    if (gate.kind !== 'pending') return;
    const requestId = gate.requestId;

    const channel = supabase
      .channel(`early-login-${requestId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'early_login_requests',
        filter: `id=eq.${requestId}`,
      }, (payload: any) => {
        const newStatus = payload.new?.status;
        if (newStatus === 'approved') {
          setGate({ kind: 'approved' });
          toast.success('Login approved by admin! Signing you in...');
          // Auto-proceed with login after approval
          handleAutoLogin();
        } else if (newStatus === 'rejected') {
          setGate({ kind: 'rejected', note: payload.new?.review_note || null });
          toast.error('Login request rejected by admin');
        }
      })
      .subscribe();

    // Also poll every 5s as fallback
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('early_login_requests')
        .select('status, review_note')
        .eq('id', requestId)
        .single();
      if (data?.status === 'approved') {
        setGate({ kind: 'approved' });
        toast.success('Login approved by admin!');
        handleAutoLogin();
      } else if (data?.status === 'rejected') {
        setGate({ kind: 'rejected', note: data.review_note });
        toast.error('Login request rejected');
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate.kind === 'pending' ? gate.requestId : null]);

  const handleAutoLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setGate({ kind: 'idle' });
    setShiftCheckInProgress(false);
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShiftCheckInProgress(true);

    // Step 1: Sign in to get user context
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      toast.error(authError.message);
      setShiftCheckInProgress(false);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setShiftCheckInProgress(false);
      setLoading(false);
      return;
    }

    // Step 2: Check if this user is an agent (admins/team leads bypass)
    const { data: userRole } = await supabase.rpc('get_user_role', { _user_id: authData.user.id });

    if (userRole !== 'agent') {
      // Non-agents can always log in
      setShiftCheckInProgress(false);
      navigate('/', { replace: true });
      setLoading(false);
      return;
    }

    // Step 3: Get agent_id
    const { data: agentId } = await supabase.rpc('get_agent_id_for_user', { _user_id: authData.user.id });

    if (!agentId) {
      setShiftCheckInProgress(false);
      navigate('/', { replace: true });
      setLoading(false);
      return;
    }

    // Step 4: Check if agent has a shift today
    const today = todayIST();
    const { data: shiftData } = await supabase
      .from('agent_shifts')
      .select('*, shift_template:shift_templates(start_time, end_time, name)')
      .eq('agent_id', agentId)
      .eq('date', today)
      .maybeSingle();

    if (!shiftData || shiftData.is_off_day) {
      // No shift assigned or off day → allow login freely
      setShiftCheckInProgress(false);
      navigate('/', { replace: true });
      setLoading(false);
      return;
    }

    // Step 5: Check shift timing (5 min before start)
    const template = shiftData.shift_template as { start_time: string } | null;
    const shiftStartMinutes = timeToMinutes(template?.start_time ?? '09:00:00');
    const nowMinutes = nowISTMinutes();
    const earlyWindow = shiftStartMinutes - 5; // 5 minutes before shift

    if (nowMinutes >= earlyWindow) {
      // Within window → allow login
      setShiftCheckInProgress(false);
      navigate('/', { replace: true });
      setLoading(false);
      return;
    }

    const { data: existingRequest } = await getExistingRequest(agentId, today);

    if (existingRequest?.status === 'approved') {
      toast.success('Your early login is already approved. Redirecting...');
      setShiftCheckInProgress(false);
      setGate({ kind: 'idle' });
      setLoading(false);
      return;
    }

    if (existingRequest?.status === 'pending') {
      await supabase.auth.signOut();
      setShiftCheckInProgress(false);
      setGate({ kind: 'pending', requestId: existingRequest.id });
      setLoading(false);
      return;
    }

    if (existingRequest?.status === 'rejected') {
      await supabase.auth.signOut();
      setShiftCheckInProgress(false);
      setGate({ kind: 'rejected', note: existingRequest.review_note });
      setLoading(false);
      return;
    }

    // Step 6: Too early — sign out and show approval request
    await supabase.auth.signOut();
    
    const shiftStartFormatted = template.start_time.substring(0, 5);
    
    // Show the blocked gate — shiftCheckInProgress stays true to prevent auto-redirect
    setShiftCheckInProgress(false);
    setGate({
      kind: 'blocked',
      shiftStart: shiftStartFormatted,
      message: `Your shift starts at ${shiftStartFormatted} IST. You can log in from ${formatEarlyTime(shiftStartFormatted)}. Request admin approval for early access.`,
    });
    setLoading(false);
  };

  const handleRequestApproval = async () => {
    setLoading(true);

    // Sign in temporarily to create the request
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      toast.error('Failed to submit request');
      setLoading(false);
      return;
    }

    const { data: agentId } = await supabase.rpc('get_agent_id_for_user', { _user_id: authData.user.id });
    const today = todayIST();

    const { data: existingRequest } = await getExistingRequest(agentId, today);

    if (existingRequest?.status === 'approved') {
      toast.success('Your early login is already approved. Redirecting...');
      setGate({ kind: 'idle' });
      setLoading(false);
      return;
    }

    if (existingRequest?.status === 'pending') {
      await supabase.auth.signOut();
      setGate({ kind: 'pending', requestId: existingRequest.id });
      toast.info('Your request is already pending admin approval.');
      setLoading(false);
      return;
    }

    if (existingRequest?.status === 'rejected') {
      await supabase.auth.signOut();
      setGate({ kind: 'rejected', note: existingRequest.review_note });
      toast.error('Your previous early login request was rejected.');
      setLoading(false);
      return;
    }

    // Get shift start time
    const { data: shiftData } = await supabase
      .from('agent_shifts')
      .select('shift_template:shift_templates(start_time)')
      .eq('agent_id', agentId)
      .eq('date', today)
      .single();

    const shiftStart = (shiftData?.shift_template as { start_time?: string } | null)?.start_time || '09:00:00';

    // Create a new request
    const { data: reqData, error: reqError } = await supabase
      .from('early_login_requests')
      .insert({
        agent_id: agentId,
        shift_date: today,
        shift_start_time: shiftStart,
        status: 'pending',
        requested_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    // Sign out again — agent waits for approval
    await supabase.auth.signOut();

    if (reqError) {
      toast.error('Failed to submit request: ' + reqError.message);
      setLoading(false);
      return;
    }

    setGate({ kind: 'pending', requestId: reqData!.id });
    toast.info('Request sent to admin. Waiting for approval...');
    setLoading(false);
  };

  const formatEarlyTime = (shiftStart: string) => {
    const [h, m] = shiftStart.split(':').map(Number);
    let totalMin = h * 60 + m - 5;
    if (totalMin < 0) totalMin += 24 * 60;
    const rh = Math.floor(totalMin / 60);
    const rm = totalMin % 60;
    return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Bluesparrow</h1>
          <p className="text-lg text-muted-foreground">Agent Portal</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {/* Normal login form */}
          {(gate.kind === 'idle' || gate.kind === 'checking' || gate.kind === 'approved') && (
            <>
              <h2 className="text-lg font-semibold mb-4 text-center">Sign In</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? (
                    <span className="animate-pulse">Signing in...</span>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Contact your Admin if you need an account.
              </p>
            </>
          )}

          {/* Blocked — shift hasn't started */}
          {gate.kind === 'blocked' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold">Shift Not Started</h2>
              <p className="text-sm text-muted-foreground">{gate.message}</p>
              
              <Button onClick={handleRequestApproval} className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending Request...</>
                ) : (
                  'Request Early Login Approval'
                )}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setGate({ kind: 'idle' })}>
                Back to Login
              </Button>
            </div>
          )}

          {/* Pending — waiting for admin */}
          {gate.kind === 'pending' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <h2 className="text-lg font-semibold">Waiting for Admin Approval</h2>
              <p className="text-sm text-muted-foreground">
                Your early login request has been sent. You'll be signed in automatically once approved.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Listening for updates...
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setGate({ kind: 'idle' })}>
                Cancel & Go Back
              </Button>
            </div>
          )}

          {/* Rejected */}
          {gate.kind === 'rejected' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold">Request Rejected</h2>
              <p className="text-sm text-muted-foreground">
                Admin has rejected your early login request.
                {gate.note && <><br />Note: {gate.note}</>}
              </p>
              <Button variant="ghost" className="w-full" onClick={() => setGate({ kind: 'idle' })}>
                Back to Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
