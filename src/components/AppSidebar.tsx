import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useInternalMessaging } from '@/hooks/useInternalMessaging';
import { SignOutModal } from '@/components/SignOutModal';
import { 
  LayoutDashboard, Phone, DollarSign, Network, BarChart3, 
  GraduationCap, Headphones, Activity, ClipboardList, Mic,
  FileText, UserCog, BookOpen, CreditCard, PhoneIncoming,
  AlertTriangle, Calendar, LogOut, MessageSquare, ClipboardCheck, FlaskConical, Search, Link2
} from 'lucide-react';

type AppRole = 'agent' | 'team_lead' | 'admin';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const agentNav: NavItem[] = [
  { label: 'Dashboard', path: '/agent', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'My Schedule', path: '/agent/schedule', icon: <Calendar className="h-4 w-4" /> },
  { label: 'Training', path: '/agent/training', icon: <GraduationCap className="h-4 w-4" /> },
  { label: 'Workspace', path: '/agent/workspace', icon: <Phone className="h-4 w-4" /> },
  { label: 'Messages', path: '/agent/messages', icon: <MessageSquare className="h-4 w-4" /> },
  { label: 'WhatsApp', path: '/agent/whatsapp', icon: <Phone className="h-4 w-4" /> },
  { label: 'Commission', path: '/agent/commission', icon: <DollarSign className="h-4 w-4" /> },
  { label: 'My Network', path: '/agent/network', icon: <Network className="h-4 w-4" /> },
  { label: 'Reports', path: '/agent/reports', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'My Attendance', path: '/agent/attendance', icon: <ClipboardCheck className="h-4 w-4" /> },
  { label: 'Onboarding', path: '/agent/onboarding', icon: <ClipboardList className="h-4 w-4" /> },
];

const teamLeadNav: NavItem[] = [
  { label: 'Team Dashboard', path: '/team-lead', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Live Calls', path: '/team-lead/live-calls', icon: <Headphones className="h-4 w-4" /> },
  { label: 'Activity Monitor', path: '/team-lead/activity', icon: <Activity className="h-4 w-4" /> },
  { label: 'Agent Performance', path: '/team-lead/performance', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Lead Queue', path: '/team-lead/leads', icon: <ClipboardList className="h-4 w-4" /> },
  { label: 'Call QA', path: '/team-lead/qa', icon: <Mic className="h-4 w-4" /> },
  { label: 'Team Reports', path: '/team-lead/reports', icon: <FileText className="h-4 w-4" /> },
];

const adminNav: NavItem[] = [
  { label: 'Operations', path: '/admin', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Calling Monitor', path: '/admin/calling', icon: <Headphones className="h-4 w-4" /> },
  { label: 'Campaigns', path: '/admin/campaigns', icon: <Mic className="h-4 w-4" /> },
  { label: 'Shifts & Roster', path: '/admin/shifts', icon: <Calendar className="h-4 w-4" /> },
  { label: 'Commission Settings', path: '/admin/commission', icon: <DollarSign className="h-4 w-4" /> },
  { label: 'Agent Management', path: '/admin/agents', icon: <UserCog className="h-4 w-4" /> },
  { label: 'Lead Management', path: '/admin/leads', icon: <ClipboardList className="h-4 w-4" /> },
  { label: 'Lead Lookup', path: '/admin/lead-lookup', icon: <Search className="h-4 w-4" /> },
  { label: 'Messages', path: '/admin/messages', icon: <MessageSquare className="h-4 w-4" /> },
  { label: 'WhatsApp', path: '/admin/whatsapp', icon: <Phone className="h-4 w-4" /> },
  { label: 'Payouts', path: '/admin/payouts', icon: <CreditCard className="h-4 w-4" /> },
  { label: 'Fraud & Audit', path: '/admin/audit', icon: <AlertTriangle className="h-4 w-4" /> },
  { label: 'Templates', path: '/admin/templates', icon: <BookOpen className="h-4 w-4" /> },
  { label: 'Lead Import', path: '/admin/lead-import', icon: <FileText className="h-4 w-4" /> },
  { label: 'Reports', path: '/admin/reports', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Onboarding', path: '/admin/onboarding', icon: <ClipboardList className="h-4 w-4" /> },
  { label: 'Payroll Management', path: '/admin/payroll', icon: <CreditCard className="h-4 w-4" /> },
  { label: 'Incoming Recordings', path: '/admin/incoming-recordings', icon: <PhoneIncoming className="h-4 w-4" /> },
  { label: 'BO Attribution', path: '/admin/bo-attribution', icon: <Link2 className="h-4 w-4" /> },
  { label: 'Testing', path: '/admin/testing', icon: <FlaskConical className="h-4 w-4" /> },
];

const navMap: Record<AppRole, NavItem[]> = {
  agent: agentNav,
  team_lead: teamLeadNav,
  admin: adminNav,
};

const roleLabels: Record<AppRole, string> = {
  agent: 'Agent',
  team_lead: 'Team Lead',
  admin: 'Admin',
};

export function AppSidebar() {
  const { role, profile, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { totalUnread } = useInternalMessaging();
  const nav = role ? navMap[role] : [];
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSignOutClick = () => {
    // For agents, show the redistribution modal
    // For other roles, show it too (they may have leads assigned)
    setShowSignOutModal(true);
  };

  return (
    <>
      <aside className="flex h-screen w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
            A
          </div>
          <span className="text-sm font-bold tracking-tight">Bluesparrow</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {nav.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/agent' && item.path !== '/team-lead' && item.path !== '/admin' && location.pathname.startsWith(item.path));
            const isMessagesNav = item.label === 'Messages';
            const hasUnread = isMessagesNav && totalUnread > 0;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary-foreground'
                    : 'text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  hasUnread && !isActive && 'text-primary bg-primary/5'
                )}
              >
                <span className="relative">
                  {item.icon}
                  {hasUnread && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  )}
                </span>
                <span className="flex-1">{item.label}</span>
                {hasUnread && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1 animate-bounce">
                    {totalUnread}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/50 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
              {profile?.full_name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[10px] text-sidebar-muted">{role ? roleLabels[role] : ''}</p>
            </div>
          </div>

          <button
            onClick={handleSignOutClick}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-sidebar-muted hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <SignOutModal
        open={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onLogout={handleLogout}
        userId={user?.id ?? null}
      />
    </>
  );
}
