import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Phone } from 'lucide-react';
import { ShiftWidget } from '@/components/ShiftWidget';
import { NotificationPanel } from '@/components/workspace/NotificationPanel';
import { SoftphonePanel } from '@/components/calling/SoftphonePanel';
import { AgentCallingProvider, useAgentCalling } from '@/contexts/AgentCallingContext';
import { cn } from '@/lib/utils';

function GlobalCallStatusBar() {
  const { callState, callDuration, isQueueActive } = useAgentCalling();
  const isActive = ['initiating', 'ringing', 'connected', 'on_hold'].includes(callState);
  if (!isActive && !isQueueActive) return null;
  const stateLabel = callState === 'initiating' ? 'Connecting...'
    : callState === 'ringing' ? 'Ringing...'
    : callState === 'connected' ? 'On Call'
    : callState === 'on_hold' ? 'On Hold'
    : isQueueActive ? 'Queue Active' : '';
  const mins = Math.floor(callDuration / 60).toString().padStart(2, '0');
  const secs = (callDuration % 60).toString().padStart(2, '0');
  return (
    <div className="flex items-center gap-2 rounded-full bg-success/10 border border-success/30 px-3 py-1 text-xs font-medium text-success">
      <Phone className="h-3 w-3 animate-pulse" />
      <span>{stateLabel}</span>
      {isActive && <span className="font-mono tabular-nums">{mins}:{secs}</span>}
    </div>
  );
}

const pageTitles: Record<string, string> = {
  '/agent': 'Dashboard',
  '/agent/training': 'Training Center',
  '/agent/workspace': 'Calling Workspace',
  '/agent/messages': 'Internal Messages',
  '/agent/whatsapp': 'WhatsApp Messaging',
  '/agent/commission': 'Commission & Earnings',
  '/agent/network': 'My Network',
  '/agent/reports': 'Reports & Analytics',
  '/team-lead': 'Team Dashboard',
  '/team-lead/live-calls': 'Live Call Monitoring',
  '/team-lead/activity': 'Shift & Activity Monitor',
  '/team-lead/performance': 'Agent Performance',
  '/team-lead/leads': 'Lead Queue Management',
  '/team-lead/qa': 'Call Recording & QA',
  '/team-lead/reports': 'Team Reports',
  '/admin': 'Live Operations',
  '/admin/shifts': 'Shifts & Roster',
  '/admin/activity': 'Activity & Salary Eligibility',
  '/admin/commission': 'Commission Settings',
  '/admin/mg': 'Salary Management',
  '/admin/agents': 'Agent Management',
  '/admin/leads': 'Lead Management',
  '/admin/messages': 'Internal Messages',
  '/admin/payouts': 'Payout Management',
  '/admin/audit': 'Fraud & Audit',
  '/admin/templates': 'Templates & Reports',
  '/admin/testing': 'Communication Testing',
};

export function AppLayout() {
  const { role } = useAuth();
  const location = useLocation();
  const [softphoneCollapsed, setSoftphoneCollapsed] = useState(true);
  const title = pageTitles[location.pathname] || 'Bluesparrow';
  const shouldShowPersistentSoftphone = role === 'agent';

  useEffect(() => {
    if (location.pathname === '/agent/workspace') {
      setSoftphoneCollapsed(false);
    }
  }, [location.pathname]);

  const layoutContent = (
    <>
      <header className="flex h-14 items-center justify-between border-b bg-card px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {role === 'agent' && <>
            <GlobalCallStatusBar />
            <ShiftWidget />
          </>}
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <Search className="h-4 w-4" />
          </button>
          <NotificationPanel />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-background">
        {role === 'agent' && location.pathname !== '/agent/reports' && (
          <div className="px-6 pt-4">
            <ShiftWidget expanded />
          </div>
        )}
        <div
          className={cn(
            'p-6',
            shouldShowPersistentSoftphone && 'xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-6',
          )}
        >
          <div className="min-w-0">
            <Outlet />
          </div>

          {shouldShowPersistentSoftphone && (
            <div className="mt-6 xl:mt-0 xl:sticky xl:top-6">
              <SoftphonePanel
                className={cn(
                  'ml-auto transition-all',
                  softphoneCollapsed ? 'w-48' : 'w-full max-w-[340px]',
                )}
                collapsed={softphoneCollapsed}
                onToggleCollapse={() => setSoftphoneCollapsed((prev) => !prev)}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        {role === 'agent' ? <AgentCallingProvider>{layoutContent}</AgentCallingProvider> : layoutContent}
      </div>
    </div>
  );
}
