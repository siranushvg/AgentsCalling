import React from 'react';
import { Users, ArrowRightLeft, Globe, Filter } from 'lucide-react';

export default function TeamLeadLeads() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-2">Lead Queue Management</h3>
        <p className="text-sm text-muted-foreground">View and manage lead assignments across your team. Filter by status, language, and temperature to identify leads that need attention or reassignment.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-sm">Filter & Sort</h4>
          </div>
          <p className="text-sm text-muted-foreground">View leads by status (new, assigned, contacted, callback), temperature (hot, warm, cool), and language. Focus on what needs immediate action.</p>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground italic">Coming soon — full lead table with advanced filtering and sorting.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-info" />
            <h4 className="font-semibold text-sm">Manual Reassignment</h4>
          </div>
          <p className="text-sm text-muted-foreground">Reassign leads between team agents based on language match, availability, or workload balance. Commission splits apply automatically.</p>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground italic">Coming soon — drag-and-drop reassignment with commission split preview.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-warning" />
            <h4 className="font-semibold text-sm">Language Coverage</h4>
          </div>
          <p className="text-sm text-muted-foreground">See which languages have unassigned leads and which agents are available to take them. Helps prevent leads from expiring without contact.</p>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground italic">Coming soon — language gap analysis with suggested reassignments.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-success" />
            <h4 className="font-semibold text-sm">Agent Workload</h4>
          </div>
          <p className="text-sm text-muted-foreground">View how many active leads each agent has, along with their callback queue. Helps distribute workload evenly across the team.</p>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground italic">Coming soon — agent capacity view with lead count and callback schedule.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
