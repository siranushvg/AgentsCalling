import React from 'react';
import { getTeamAgents, mockSalarySettings } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';

export default function TeamLeadActivity() {
  const teamAgents = getTeamAgents('tl1');
  const settings = mockSalarySettings;
  const activityData = [
    { agent: teamAgents[0], hours: 172, calls: 620, sessions: 22, idle: 2.1, hoursOk: true, callsOk: true },
    { agent: teamAgents[1], hours: 148, calls: 520, sessions: 20, idle: 1.5, hoursOk: false, callsOk: true },
    { agent: teamAgents[2], hours: 165, calls: 480, sessions: 23, idle: 0.8, hoursOk: true, callsOk: false },
    { agent: teamAgents[3], hours: 120, calls: 310, sessions: 15, idle: 5.2, hoursOk: false, callsOk: false },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Monthly Activity & Salary Eligibility</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Agent</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Hours ({settings.min_hours_required}h req)</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Progress</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Calls ({settings.min_calls_required} req)</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Sessions</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Salary Status</th>
            </tr>
          </thead>
          <tbody>
            {activityData.map((row) => {
              const status = row.hoursOk && row.callsOk ? 'eligible' : (row.hoursOk || row.callsOk) ? 'at_risk' : 'not_eligible';
              const label = row.hoursOk && row.callsOk ? 'Full' : (row.hoursOk || row.callsOk) ? 'Partial' : 'Not Eligible';
              return (
                <tr key={row.agent?.id} className="border-b hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{row.agent?.full_name}</td>
                  <td className="px-4 py-3 text-center font-mono">
                    <span className={row.hoursOk ? 'text-success' : 'text-destructive'}>{row.hours}h</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="mx-auto w-24 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.hoursOk ? 'bg-success' : row.hours >= settings.min_hours_required * 0.8 ? 'bg-warning' : 'bg-destructive'}`}
                        style={{ width: `${Math.min((row.hours / settings.min_hours_required) * 100, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">
                    <span className={row.callsOk ? 'text-success' : 'text-destructive'}>{row.calls}</span>
                  </td>
                  <td className="px-4 py-3 text-center">{row.sessions}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge variant={status as any}>{label}</StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
