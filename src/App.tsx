import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WorkspaceNotificationProvider } from "@/contexts/WorkspaceNotificationContext";
import { InactivityProvider } from "@/contexts/InactivityContext";
import { VoicelayProvider } from "@/contexts/VoicelayContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import ForbiddenPage from "@/pages/ForbiddenPage";
import NotFound from "@/pages/NotFound";
import AgentDashboard from "@/pages/agent/AgentDashboard";
import AgentTraining from "@/pages/agent/AgentTraining";
import AgentWorkspace from "@/pages/agent/AgentWorkspace";
import AgentCommission from "@/pages/agent/AgentCommission";
import AgentNetwork from "@/pages/agent/AgentNetwork";
import AgentMessages from "@/pages/agent/AgentMessages";
import AgentReports from "@/pages/agent/AgentReports";
import AgentAttendance from "@/pages/agent/AgentAttendance";
import AgentWhatsApp from "@/pages/agent/AgentWhatsApp";
import AgentOnboarding from "@/pages/agent/AgentOnboarding";
import AgentSchedule from "@/pages/agent/AgentSchedule";
import TeamLeadDashboard from "@/pages/team-lead/TeamLeadDashboard";
import TeamLeadLiveCalls from "@/pages/team-lead/TeamLeadLiveCalls";
import TeamLeadActivity from "@/pages/team-lead/TeamLeadActivity";
import TeamLeadPerformance from "@/pages/team-lead/TeamLeadPerformance";
import TeamLeadLeads from "@/pages/team-lead/TeamLeadLeads";
import TeamLeadQA from "@/pages/team-lead/TeamLeadQA";
import TeamLeadReports from "@/pages/team-lead/TeamLeadReports";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminShifts from "@/pages/admin/AdminShifts";
import AdminCommission from "@/pages/admin/AdminCommission";
import AdminAgents from "@/pages/admin/AdminAgents";
import AdminLeads from "@/pages/admin/AdminLeads";
import AdminPayouts from "@/pages/admin/AdminPayouts";
import AdminAudit from "@/pages/admin/AdminAudit";
import AdminTemplates from "@/pages/admin/AdminTemplates";
import AdminMessages from "@/pages/admin/AdminMessages";
import AdminLeadImport from "@/pages/admin/AdminLeadImport";
import AdminCampaigns from "@/pages/admin/AdminCampaigns";
import AdminCallingDashboard from "@/pages/admin/AdminCallingDashboard";
import AdminReports from "@/pages/admin/AdminReports";
import AdminOnboarding from "@/pages/admin/AdminOnboarding";
import AdminTesting from "@/pages/admin/AdminTesting";
import AdminLeadLookup from "@/pages/admin/AdminLeadLookup";
import AdminPayroll from "@/pages/admin/AdminPayroll";
import AdminIncomingRecordings from "@/pages/admin/AdminIncomingRecordings";
import AdminBOAttribution from "@/pages/admin/AdminBOAttribution";

const queryClient = new QueryClient();

function RoleRedirect() {
  const { role, isLoading, isAuthenticated } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  if (role === 'agent') return <Navigate to="/agent" replace />;
  if (role === 'team_lead') return <Navigate to="/team-lead" replace />;
  if (role === 'admin') return <Navigate to="/admin" replace />;

  return <Navigate to="/forbidden" replace />;
}

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
        <InactivityProvider>
        <VoicelayProvider>
        <WorkspaceNotificationProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forbidden" element={<ForbiddenPage />} />
            <Route path="/" element={<RoleRedirect />} />

            {/* Agent Routes */}
            <Route element={<ProtectedRoute allowedRoles={['agent']} />}>
              <Route element={<AppLayout />}>
                <Route path="/agent" element={<AgentDashboard />} />
                <Route path="/agent/schedule" element={<AgentSchedule />} />
                <Route path="/agent/training" element={<AgentTraining />} />
                <Route path="/agent/calling" element={<Navigate to="/agent/workspace" replace />} />
                <Route path="/agent/workspace" element={<AgentWorkspace />} />
                <Route path="/agent/messages" element={<AgentMessages />} />
                <Route path="/agent/whatsapp" element={<AgentWhatsApp />} />
                <Route path="/agent/commission" element={<AgentCommission />} />
                <Route path="/agent/network" element={<AgentNetwork />} />
                <Route path="/agent/reports" element={<AgentReports />} />
                <Route path="/agent/attendance" element={<AgentAttendance />} />
                <Route path="/agent/onboarding" element={<AgentOnboarding />} />
              </Route>
            </Route>

            {/* Team Lead Routes */}
            <Route element={<ProtectedRoute allowedRoles={['team_lead']} />}>
              <Route element={<AppLayout />}>
                <Route path="/team-lead" element={<TeamLeadDashboard />} />
                <Route path="/team-lead/live-calls" element={<TeamLeadLiveCalls />} />
                <Route path="/team-lead/activity" element={<TeamLeadActivity />} />
                <Route path="/team-lead/performance" element={<TeamLeadPerformance />} />
                <Route path="/team-lead/leads" element={<TeamLeadLeads />} />
                <Route path="/team-lead/qa" element={<TeamLeadQA />} />
                <Route path="/team-lead/reports" element={<TeamLeadReports />} />
              </Route>
            </Route>

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route element={<AppLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/calling" element={<AdminCallingDashboard />} />
                <Route path="/admin/campaigns" element={<AdminCampaigns />} />
                <Route path="/admin/shifts" element={<AdminShifts />} />
                <Route path="/admin/commission" element={<AdminCommission />} />
                <Route path="/admin/agents" element={<AdminAgents />} />
                <Route path="/admin/leads" element={<AdminLeads />} />
                <Route path="/admin/lead-lookup" element={<AdminLeadLookup />} />
                <Route path="/admin/messages" element={<AdminMessages />} />
                <Route path="/admin/whatsapp" element={<AgentWhatsApp />} />
                <Route path="/admin/payouts" element={<AdminPayouts />} />
                <Route path="/admin/audit" element={<AdminAudit />} />
                <Route path="/admin/templates" element={<AdminTemplates />} />
                <Route path="/admin/lead-import" element={<AdminLeadImport />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/onboarding" element={<AdminOnboarding />} />
                <Route path="/admin/testing" element={<AdminTesting />} />
                <Route path="/admin/payroll" element={<AdminPayroll />} />
                <Route path="/admin/incoming-recordings" element={<AdminIncomingRecordings />} />
                <Route path="/admin/bo-attribution" element={<AdminBOAttribution />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </WorkspaceNotificationProvider>
        </VoicelayProvider>
        </InactivityProvider>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
