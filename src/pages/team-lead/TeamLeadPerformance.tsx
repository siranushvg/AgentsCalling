import React, { useState } from 'react';
import { getTeamAgents } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { DetailDrawer } from '@/components/DetailDrawer';
import { exportToCSV } from '@/lib/exportCSV';
import { Button } from '@/components/ui/button';
import { Download, Flag, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TeamLeadPerformance() {
  const teamAgents = getTeamAgents('tl1');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const perfData = [
    { agent: teamAgents[0], dials: 420, contacts: 210, ftds: 28, conversion: 13.3, commission: 98000, mgEligible: true, trend: 'up' as const },
    { agent: teamAgents[1], dials: 380, contacts: 185, ftds: 22, conversion: 11.9, commission: 77000, mgEligible: true, trend: 'up' as const },
    { agent: teamAgents[2], dials: 290, contacts: 130, ftds: 15, conversion: 11.5, commission: 52500, mgEligible: true, trend: 'flat' as const },
    { agent: teamAgents[3], dials: 150, contacts: 60, ftds: 5, conversion: 8.3, commission: 17500, mgEligible: false, trend: 'down' as const },
  ];

  const selectedPerf = perfData.find(p => p.agent?.id === selectedAgent);

  const dailyTrend = [
    { day: 'Mon', dials: 85, ftds: 6 },
    { day: 'Tue', dials: 92, ftds: 8 },
    { day: 'Wed', dials: 78, ftds: 4 },
    { day: 'Thu', dials: 95, ftds: 7 },
    { day: 'Fri', dials: 70, ftds: 3 },
  ];

  const handleExport = () => {
    exportToCSV(
      perfData.map(r => ({
        Agent: r.agent?.full_name || '',
        Dials: r.dials,
        Contacts: r.contacts,
        FTDs: r.ftds,
        Conversion: `${r.conversion}%`,
        Commission: r.commission,
        MG_Eligible: r.mgEligible ? 'Yes' : 'No',
      })),
      'team_performance'
    );
    toast.success('Performance data exported');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Agent Performance (This Month)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Agent</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Dials</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Contacts</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">FTDs</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Conv %</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Commission</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">MG</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Trend</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Training</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {perfData.map(row => (
                <tr key={row.agent?.id} className="border-b hover:bg-accent/30 cursor-pointer" onClick={() => setSelectedAgent(row.agent?.id || null)}>
                  <td className="px-4 py-2.5 font-medium">{row.agent?.full_name}</td>
                  <td className="px-4 py-2.5 text-right">{row.dials}</td>
                  <td className="px-4 py-2.5 text-right">{row.contacts}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{row.ftds}</td>
                  <td className="px-4 py-2.5 text-right">{row.conversion}%</td>
                  <td className="px-4 py-2.5 text-right text-earning font-medium">₹{row.commission.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-center">
                    <StatusBadge variant={row.mgEligible ? 'eligible' : 'not_eligible'}>
                      {row.mgEligible ? 'Eligible' : 'Not Eligible'}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.trend === 'up' ? <TrendingUp className="h-4 w-4 text-success mx-auto" /> :
                     row.trend === 'down' ? <TrendingDown className="h-4 w-4 text-destructive mx-auto" /> :
                     <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <StatusBadge variant={row.agent?.training_completed ? 'completed' : 'training'}>
                      {row.agent?.training_completed ? 'Complete' : `${row.agent?.training_progress}/6`}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => { toast.success(`${row.agent?.full_name} flagged for review`); }}>
                      <Flag className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Drilldown Drawer */}
      <DetailDrawer
        open={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
        title={selectedPerf?.agent?.full_name || ''}
        subtitle="Performance Drilldown"
      >
        {selectedPerf && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">FTDs</p>
                <p className="text-xl font-bold">{selectedPerf.ftds}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Conv %</p>
                <p className="text-xl font-bold">{selectedPerf.conversion}%</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Commission</p>
                <p className="text-xl font-bold text-earning">₹{(selectedPerf.commission / 1000).toFixed(0)}k</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">DAILY TREND</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="dials" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Dials" />
                  <Bar dataKey="ftds" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} name="FTDs" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">DISPOSITION BREAKDOWN</h4>
              <div className="space-y-1.5">
                {[
                  { label: 'Interested', pct: 35, color: 'bg-earning' },
                  { label: 'Callback', pct: 25, color: 'bg-warning' },
                  { label: 'Not Interested', pct: 20, color: 'bg-muted-foreground' },
                  { label: 'No Answer', pct: 15, color: 'bg-info' },
                  { label: 'Converted', pct: 5, color: 'bg-success' },
                ].map(d => (
                  <div key={d.label}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span>{d.label}</span><span className="font-medium">{d.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${d.color}`} style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => toast.success('Flagged for review')}>
                <Flag className="h-4 w-4 mr-1" /> Flag for Review
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
