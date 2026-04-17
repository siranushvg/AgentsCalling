import React, { useState, useMemo } from 'react';
import { mockSalaryPayments, mockSalarySettings, mockSalaryTiers, mockAgents } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { KPICard } from '@/components/KPICard';
import {
  Users, AlertTriangle, ShieldX, DollarSign, Clock, Phone,
  CheckCircle2, Edit2, X, Check, Briefcase
} from 'lucide-react';
import { SalaryPayment } from '@/types';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type SalaryStatus = SalaryPayment['status'];
const STATUS_OPTIONS: SalaryStatus[] = ['pending', 'paid', 'withheld'];

function getAgentName(agentId: string): string {
  return mockAgents.find(a => a.id === agentId)?.full_name || agentId;
}

function getAgentCity(agentId: string): string {
  return mockAgents.find(a => a.id === agentId)?.city || '—';
}

export default function AdminMG() {
  const [payments, setPayments] = useState<SalaryPayment[]>(mockSalaryPayments);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [filterEligibility, setFilterEligibility] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const settings = mockSalarySettings;

  const filtered = useMemo(() => {
    return payments.filter(sp => {
      if (filterEligibility === 'hours_eligible' && !sp.hours_eligible) return false;
      if (filterEligibility === 'calls_eligible' && !sp.calls_eligible) return false;
      if (filterEligibility === 'both_eligible' && (!sp.hours_eligible || !sp.calls_eligible)) return false;
      if (filterEligibility === 'not_eligible' && (sp.hours_eligible || sp.calls_eligible)) return false;
      if (filterStatus !== 'all' && sp.status !== filterStatus) return false;
      return true;
    });
  }, [payments, filterEligibility, filterStatus]);

  const fullyEligible = payments.filter(m => m.hours_eligible && m.calls_eligible);
  const partiallyEligible = payments.filter(m => m.hours_eligible !== m.calls_eligible);
  const notEligible = payments.filter(m => !m.hours_eligible && !m.calls_eligible);
  const totalPaid = payments.filter(m => m.status === 'paid').reduce((s, m) => s + m.total_salary, 0);

  const startEditing = (sp: SalaryPayment) => {
    setEditingId(sp.id);
    setEditAmount(sp.basic_salary);
  };

  const saveAmount = (id: string) => {
    setPayments(prev => prev.map(sp =>
      sp.id === id ? { ...sp, basic_salary: editAmount, total_salary: (sp.hours_eligible ? editAmount : 0) + sp.call_bonus } : sp
    ));
    setEditingId(null);
    toast.success('Salary amount updated');
  };

  const changeStatus = (id: string, newStatus: SalaryStatus) => {
    setPayments(prev => prev.map(sp =>
      sp.id === id ? { ...sp, status: newStatus } : sp
    ));
    toast.success(`Payment status changed to ${newStatus}`);
  };

  return (
    <div className="space-y-6">
      {/* Thresholds banner */}
      <div className="rounded-lg border bg-primary/5 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm">
          <span className="font-medium">Eligibility Thresholds:</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> Min Hours: <strong>{settings.min_hours_required}h</strong></span>
          <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> Min Calls: <strong>{settings.min_calls_required}</strong></span>
          <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> Call Bonus: <strong>₹{settings.call_bonus_amount.toLocaleString()}</strong></span>
        </div>
      </div>

      {/* Tiers */}
      <div className="grid grid-cols-3 gap-4">
        {mockSalaryTiers.map(tier => (
          <div key={tier.id} className="rounded-lg border bg-card p-4 text-center shadow-sm">
            <Briefcase className="h-5 w-5 mx-auto text-primary mb-2" />
            <p className="font-semibold">{tier.name}</p>
            <p className="text-2xl font-bold mt-1">₹{tier.basic_salary.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tier.max_tenure_months ? `${tier.min_tenure_months}–${tier.max_tenure_months} months` : `${tier.min_tenure_months}+ months`}
            </p>
          </div>
        ))}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Fully Eligible"
          value={fullyEligible.length}
          subtitle="Hours + Calls met"
          icon={<CheckCircle2 className="h-5 w-5" />}
          avatars={fullyEligible.map(m => getAgentName(m.agent_id))}
        />
        <KPICard
          title="Partially Eligible"
          value={partiallyEligible.length}
          subtitle="One condition met"
          icon={<AlertTriangle className="h-5 w-5" />}
          avatars={partiallyEligible.map(m => getAgentName(m.agent_id))}
        />
        <KPICard
          title="Not Eligible"
          value={notEligible.length}
          subtitle="Neither condition met"
          icon={<ShieldX className="h-5 w-5" />}
          avatars={notEligible.map(m => getAgentName(m.agent_id))}
        />
        <KPICard
          title="Total Paid"
          value={`₹${totalPaid.toLocaleString()}`}
          subtitle={`${payments.filter(m => m.status === 'paid').length} agents`}
          icon={<DollarSign className="h-5 w-5" />}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterEligibility} onValueChange={setFilterEligibility}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Eligibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            <SelectItem value="both_eligible">Fully Eligible</SelectItem>
            <SelectItem value="hours_eligible">Hours Met Only</SelectItem>
            <SelectItem value="calls_eligible">Calls Met Only</SelectItem>
            <SelectItem value="not_eligible">Not Eligible</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="withheld">Withheld</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          Showing {filtered.length} of {payments.length} records
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Agent</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tier</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Basic Salary</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Hours</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Calls</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Call Bonus</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground w-[80px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(sp => {
              const isEditing = editingId === sp.id;
              const name = getAgentName(sp.agent_id);

              return (
                <tr key={sp.id} className="border-b hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                        {name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <p className="font-medium">{name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{sp.tier_name}</td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-muted-foreground">₹</span>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={e => setEditAmount(Number(e.target.value))}
                          className="w-24 rounded border bg-background px-2 py-1 text-right text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <button onClick={() => saveAmount(sp.id)} className="rounded p-1 text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <span className="font-mono font-medium">₹{sp.basic_salary.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-mono font-medium">{sp.hours_logged}h</span>
                      <StatusBadge variant={sp.hours_eligible ? 'eligible' : 'not_eligible'}>
                        {sp.hours_eligible ? '✓ Met' : `Need ${(settings.min_hours_required - sp.hours_logged).toFixed(0)}h`}
                      </StatusBadge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-mono font-medium">{sp.calls_made}</span>
                      <StatusBadge variant={sp.calls_eligible ? 'eligible' : 'not_eligible'}>
                        {sp.calls_eligible ? '✓ Met' : `Need ${settings.min_calls_required - sp.calls_made}`}
                      </StatusBadge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">₹{sp.call_bonus.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">₹{sp.total_salary.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <Select value={sp.status} onValueChange={(val) => changeStatus(sp.id, val as SalaryStatus)}>
                      <SelectTrigger className="h-7 w-[110px] mx-auto text-xs border-dashed">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s} value={s}>
                            <StatusBadge variant={s as any}>{s}</StatusBadge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!isEditing && (
                      <button
                        onClick={() => startEditing(sp)}
                        className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Edit salary amount"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  No records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Eligibility rules reference */}
      <div className="rounded-lg border bg-muted/30 px-5 py-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">Salary Eligibility Rules</p>
        <div className="flex gap-6 text-xs text-muted-foreground">
          <span><span className="text-success font-medium">Basic Salary:</span> {settings.min_hours_required}+ hours on duty/month</span>
          <span><span className="text-info font-medium">Call Bonus:</span> {settings.min_calls_required}+ calls/month → ₹{settings.call_bonus_amount.toLocaleString()}</span>
          <span className="border-l border-border pl-6">Conditions are evaluated independently — meeting one doesn't require the other</span>
        </div>
      </div>
    </div>
  );
}
