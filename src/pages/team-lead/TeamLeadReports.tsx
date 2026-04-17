import React from 'react';
import { BarChart3, Users, Globe, Clock } from 'lucide-react';

export default function TeamLeadReports() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-2">Team Reports</h3>
        <p className="text-sm text-muted-foreground">Access performance summaries, language breakdowns, shift adherence, and hourly trends for your team.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-sm">Leaderboards</h4>
          </div>
          <p className="text-sm text-muted-foreground">See which agents are leading in dials, contacts, FTDs, and conversion rate. Use this to identify top performers and coaching opportunities.</p>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground italic">Coming soon — weekly and monthly leaderboard rankings with trend indicators.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-info" />
            <h4 className="font-semibold text-sm">Language Performance</h4>
          </div>
          <p className="text-sm text-muted-foreground">Understand which language segments are converting best. Helps with lead allocation and hiring priorities.</p>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground italic">Coming soon — conversion rates and FTD counts by language across your team.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            <h4 className="font-semibold text-sm">Shift Adherence</h4>
          </div>
          <p className="text-sm text-muted-foreground">Track how consistently your agents are logging in on time and staying active during their shift windows.</p>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground italic">Coming soon — login times, active hours, and idle alerts per agent per shift.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-success" />
            <h4 className="font-semibold text-sm">Hourly Trends</h4>
          </div>
          <p className="text-sm text-muted-foreground">Identify peak productivity hours and optimise shift schedules based on team activity patterns.</p>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground italic">Coming soon — hourly dials, contacts, and FTDs across your entire team.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
