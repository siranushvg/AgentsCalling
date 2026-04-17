import React from 'react';
import { mockSalaryPayments, mockSalarySettings, mockAgents } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { KPICard } from '@/components/KPICard';
import { Activity, Users, AlertTriangle, Phone, Clock } from 'lucide-react';

function getAgentName(agentId: string): string {
  return mockAgents.find(a => a.id === agentId)?.full_name || agentId;
}

export default function AdminActivity() {
  const settings = mockSalarySettings;
  const fullyEligible = mockSalaryPayments.filter(m => m.hours_eligible && m.calls_eligible);
  const partial = mockSalaryPayments.filter(m => m.hours_eligible !== m.calls_eligible);
  const notEligible = mockSalaryPayments.filter(m => !m.hours_eligible && !m.calls_eligible);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KPICard title="Fully Eligible" value={fullyEligible.length} icon={<Users className="h-5 w-5" />} subtitle={`${settings.min_hours_required}h + ${settings.min_calls_required} calls`} />
        <KPICard title="Partial" value={partial.length} icon={<AlertTriangle className="h-5 w-5" />} subtitle="One condition met" />
        <KPICard title="Not Eligible" value={notEligible.length} icon={<Activity className="h-5 w-5" />} subtitle="Neither condition met" />
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Salary Eligibility Report</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Agent</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Month</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Tier</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Basic Salary</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Hours</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Calls</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockSalaryPayments.map(sp => (
              <tr key={sp.id} className="border-b hover:bg-accent/30">
                <td className="px-4 py-2.5 font-medium">{getAgentName(sp.agent_id)}</td>
                <td className="px-4 py-2.5 text-center">{sp.month}</td>
                <td className="px-4 py-2.5 text-center">{sp.tier_name}</td>
                <td className="px-4 py-2.5 text-right">₹{sp.basic_salary.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`font-mono ${sp.hours_eligible ? 'text-success' : 'text-destructive'}`}>
                    {sp.hours_logged}h / {settings.min_hours_required}h
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`font-mono ${sp.calls_eligible ? 'text-success' : 'text-destructive'}`}>
                    {sp.calls_made} / {settings.min_calls_required}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold">₹{sp.total_salary.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-center">
                  <StatusBadge variant={sp.status as React.ComponentProps<typeof StatusBadge>['variant']}>{sp.status}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
