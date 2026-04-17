import React, { useState } from 'react';
import { mockPayouts, mockAgents } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { DetailDrawer } from '@/components/DetailDrawer';
import { exportToCSV } from '@/lib/exportCSV';
import { Download, DollarSign, AlertTriangle } from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import { Payout } from '@/types';
import { toast } from 'sonner';

export default function AdminPayouts() {
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showClawback, setShowClawback] = useState(false);
  const [clawbackAmount, setClawbackAmount] = useState('');
  const [clawbackReason, setClawbackReason] = useState('');

  const agentName = (id: string) => mockAgents.find(a => a.id === id)?.full_name || id;

  const totalPending = mockPayouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.net_payout, 0);
  const totalProcessed = mockPayouts.filter(p => p.status === 'processed').reduce((s, p) => s + p.net_payout, 0);
  const totalPaid = mockPayouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.net_payout, 0);

  const handleExport = () => {
    exportToCSV(
      mockPayouts.map(p => ({
        Agent: agentName(p.agent_id),
        Period: `${p.period_start} – ${p.period_end}`,
        Commission: p.commission_earned,
        Basic_Salary: p.basic_salary_paid,
        Call_Bonus: p.call_bonus_paid,
        Net_Payout: p.net_payout,
        Status: p.status,
      })),
      'payouts'
    );
    toast.success('Payouts exported to CSV');
  };

  const handleClawback = () => {
    if (!clawbackAmount || !clawbackReason.trim()) return;
    toast.success(`Clawback of ₹${clawbackAmount} processed. Reason logged.`);
    setShowClawback(false);
    setClawbackAmount('');
    setClawbackReason('');
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard title="Pending Payouts" value={`₹${totalPending.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} subtitle={`${mockPayouts.filter(p => p.status === 'pending').length} agents`} />
        <KPICard title="Processing" value={`₹${totalProcessed.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
        <KPICard title="Paid This Period" value={`₹${totalPaid.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
      </div>

      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowClawback(true)}>
            <AlertTriangle className="h-4 w-4 mr-1" /> Clawback
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => toast.success('Monthly payout run initiated')}>
            Run Monthly Payout
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Payout History</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Agent</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Period</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Salary</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Bonus</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Commission</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Net Payout</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockPayouts.map(p => (
              <tr key={p.id} className="border-b hover:bg-accent/30 cursor-pointer" onClick={() => setSelectedPayout(p)}>
                <td className="px-4 py-2.5 font-medium">{agentName(p.agent_id)}</td>
                <td className="px-4 py-2.5">{p.period_start} – {p.period_end}</td>
                <td className="px-4 py-2.5 text-right">₹{p.basic_salary_paid.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">₹{p.call_bonus_paid.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">₹{p.commission_earned.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-semibold">₹{p.net_payout.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-center"><StatusBadge variant={p.status as any}>{p.status}</StatusBadge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payout Detail Drawer */}
      <DetailDrawer
        open={!!selectedPayout}
        onClose={() => setSelectedPayout(null)}
        title={selectedPayout ? agentName(selectedPayout.agent_id) : ''}
        subtitle={selectedPayout ? `${selectedPayout.period_start} – ${selectedPayout.period_end}` : ''}
      >
        {selectedPayout && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-xs text-muted-foreground">Basic Salary</p>
                <p className="text-xl font-bold">₹{selectedPayout.basic_salary_paid.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-xs text-muted-foreground">Call Bonus</p>
                <p className="text-xl font-bold">₹{selectedPayout.call_bonus_paid.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-xs text-muted-foreground">Commission</p>
                <p className="text-xl font-bold text-earning">₹{selectedPayout.commission_earned.toLocaleString()}</p>
              </div>
            </div>
            <div className="rounded-lg bg-primary/10 p-4 text-center">
              <p className="text-xs text-muted-foreground">Net Payout</p>
              <p className="text-2xl font-bold text-primary">₹{selectedPayout.net_payout.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Salary + Bonus + Commission</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge variant={selectedPayout.status as any}>{selectedPayout.status}</StatusBadge>
            </div>
            {selectedPayout.status === 'pending' && (
              <Button className="w-full" onClick={() => toast.success('Payout approved')}>Approve Payout</Button>
            )}
          </div>
        )}
      </DetailDrawer>

      {/* Clawback Modal */}
      {showClawback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-xl space-y-4">
            <h3 className="font-semibold">Process Clawback</h3>
            <p className="text-sm text-muted-foreground">For deposit reversals. This will deduct from the agent's next payout.</p>
            <input type="number" placeholder="Amount (₹)" value={clawbackAmount} onChange={e => setClawbackAmount(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            <textarea placeholder="Reason for clawback..." value={clawbackReason} onChange={e => setClawbackReason(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowClawback(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleClawback} disabled={!clawbackAmount || !clawbackReason.trim()}>Process Clawback</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
