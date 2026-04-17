import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, RefreshCw, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SignOutModalProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => Promise<void>;
  userId: string | null;
}

type ModalStep = 'confirm' | 'redistributing' | 'success' | 'error';

export function SignOutModal({ open, onClose, onLogout, userId }: SignOutModalProps) {
  const [step, setStep] = useState<ModalStep>('confirm');
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    redistributed: number;
    online_agents: number;
    unassigned: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch the agent's remaining lead count when modal opens
  useEffect(() => {
    if (!open || !userId) return;
    setStep('confirm');
    setResult(null);
    setErrorMsg('');

    (async () => {
      // Get agent id for the current user
      const { data: agentId } = await supabase.rpc('get_agent_id_for_user', { _user_id: userId });
      if (!agentId) {
        setLeadCount(0);
        return;
      }

      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', agentId)
        .in('status', ['new', 'assigned', 'callback'])
        .eq('suppressed', false);

      setLeadCount(count ?? 0);
    })();
  }, [open, userId]);

  const handleRedistribute = async () => {
    if (!userId) return;
    setStep('redistributing');
    setLoading(true);

    try {
      const { data: agentId } = await supabase.rpc('get_agent_id_for_user', { _user_id: userId });
      if (!agentId) {
        setErrorMsg('Could not identify your agent profile.');
        setStep('error');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('redistribute_agent_leads', { p_agent_id: agentId });

      if (error) {
        console.error('Redistribution failed:', error);
        setErrorMsg(error.message || 'Redistribution failed. Please try again.');
        setStep('error');
        setLoading(false);
        return;
      }

      const res = data as { redistributed?: number; online_agents?: number; unassigned?: boolean } | null;
      setResult({
        redistributed: res?.redistributed ?? 0,
        online_agents: res?.online_agents ?? 0,
        unassigned: res?.unassigned ?? false,
      });
      setStep('success');
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAfterSuccess = async () => {
    setLoading(true);
    await onLogout();
    setLoading(false);
  };

  const handleSignOutWithout = async () => {
    setLoading(true);
    await onLogout();
    setLoading(false);
  };

  const hasLeads = (leadCount ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onClose(); }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => { if (loading) e.preventDefault(); }}>
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5 text-muted-foreground" />
                Before you sign out
              </DialogTitle>
              <DialogDescription>
                {hasLeads ? (
                  <>
                    You have <span className="font-semibold text-foreground">{leadCount}</span> remaining lead{leadCount !== 1 ? 's' : ''} assigned to you.
                    Would you like to redistribute them to currently online agents before signing out?
                  </>
                ) : (
                  'You have no remaining assigned leads. You can sign out safely.'
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              {hasLeads && (
                <Button onClick={handleRedistribute} className="w-full gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Redistribute My Leads ({leadCount})
                </Button>
              )}
              <Button variant="outline" onClick={handleSignOutWithout} className="w-full gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out Without Redistributing
              </Button>
              <Button variant="ghost" onClick={onClose} className="w-full">
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'redistributing' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Redistributing leads…
              </DialogTitle>
              <DialogDescription>
                Finding online agents and redistributing your {leadCount} lead{leadCount !== 1 ? 's' : ''}.
                This may take a moment.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          </>
        )}

        {step === 'success' && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Leads redistributed
              </DialogTitle>
              <DialogDescription>
                {result.unassigned ? (
                  <>
                    No online agents were available. Your <span className="font-semibold text-foreground">{result.redistributed}</span> lead{result.redistributed !== 1 ? 's were' : ' was'} moved to the unassigned pool for admin review.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">{result.redistributed}</span> lead{result.redistributed !== 1 ? 's were' : ' was'} redistributed to <span className="font-semibold text-foreground">{result.online_agents}</span> online agent{result.online_agents !== 1 ? 's' : ''}.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {result.unassigned && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  These leads will appear in the admin's lead management panel for manual reassignment.
                </p>
              </div>
            )}
            {!result.unassigned && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 p-3 flex items-start gap-2">
                <Users className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  Leads have been evenly distributed. Each agent received approximately {Math.ceil(result.redistributed / result.online_agents)} lead{Math.ceil(result.redistributed / result.online_agents) !== 1 ? 's' : ''}.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleLogoutAfterSuccess} disabled={loading} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Complete Sign Out
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Redistribution failed
              </DialogTitle>
              <DialogDescription>{errorMsg}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={handleRedistribute} className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry Redistribution
              </Button>
              <Button variant="outline" onClick={handleSignOutWithout} className="w-full gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out Without Redistributing
              </Button>
              <Button variant="ghost" onClick={onClose} className="w-full">
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
