import React, { useState, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, TrendingUp, CreditCard, Calculator, HelpCircle, Wallet } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

export default function AgentCommission() {
  const { user } = useAuth();
  const [calcDeposit, setCalcDeposit] = useState([1000]);
  const [monthlySalary, setMonthlySalary] = useState(0);
  const [commissionRates, setCommissionRates] = useState({ direct_rate: 30, tier2_rate: 5, tier3_rate: 3 });
  const [salarySettings, setSalarySettings] = useState({ min_hours_required: 208, min_calls_required: 1050, call_bonus_amount: 5000 });
  const [salaryPayment, setSalaryPayment] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Fetch agent's monthly salary
    const { data: agentData } = await supabase
      .from('agents')
      .select('monthly_salary')
      .eq('user_id', user.id)
      .single();
    if (agentData) setMonthlySalary(Number((agentData as any).monthly_salary) || 0);

    // Fetch commission rates
    const { data: ratesData } = await supabase
      .from('commission_settings')
      .select('*')
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();
    if (ratesData) setCommissionRates({ direct_rate: ratesData.direct_rate, tier2_rate: ratesData.tier2_rate, tier3_rate: ratesData.tier3_rate });

    // Fetch salary settings
    const { data: settingsData } = await supabase
      .from('salary_settings')
      .select('*')
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();
    if (settingsData) setSalarySettings({ min_hours_required: settingsData.min_hours_required, min_calls_required: settingsData.min_calls_required, call_bonus_amount: settingsData.call_bonus_amount });

    // Fetch agent id then salary payment, commissions, payouts
    const { data: agentIdData } = await supabase.rpc('get_agent_id_for_user', { _user_id: user.id });
    if (agentIdData) {
      const agentId = agentIdData;

      const { data: sp } = await supabase.from('salary_payments').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(1).single();
      if (sp) setSalaryPayment(sp);

      const { data: comm } = await supabase.from('commissions').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(50);
      if (comm) setCommissions(comm);

      const { data: po } = await supabase.from('payouts').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(10);
      if (po) setPayouts(po);
    }
  };

  const rates = commissionRates;
  const settings = salarySettings;
  const agentEarning = (calcDeposit[0] * rates.direct_rate) / 100;
  const tier2Earning = (calcDeposit[0] * rates.tier2_rate) / 100;
  const tier3Earning = (calcDeposit[0] * rates.tier3_rate) / 100;

  return (
    <div className="space-y-6">
      {/* How Earnings Work */}
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" /> How Your Earnings Work
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p><span className="font-medium text-foreground">Monthly Salary:</span> You receive a fixed monthly salary set by Admin. To be eligible, you must complete at least {settings.min_hours_required} hours on duty this month.</p>
            <p><span className="font-medium text-foreground">Call Bonus:</span> Complete at least {settings.min_calls_required} calls per week to earn an additional ₹{settings.call_bonus_amount.toLocaleString()} call bonus on top of your salary.</p>
            <p><span className="font-medium text-foreground">Direct Commission ({rates.direct_rate}%):</span> Earned from your own successful conversions. You receive {rates.direct_rate}% of every first-time deposit (FTD) you personally convert.</p>
          </div>
          <div className="space-y-2">
            <p><span className="font-medium text-foreground">Tier 2 Earnings ({rates.tier2_rate}%):</span> Earned from the activity of agents directly under your referral network. When someone you referred converts a lead, you earn {rates.tier2_rate}% of that FTD — passively.</p>
            <p><span className="font-medium text-foreground">Tier 3 Earnings ({rates.tier3_rate}%):</span> Earned from the next referral layer below Tier 2. If your referral's referral converts a lead, you earn {rates.tier3_rate}%.</p>
            <p><span className="font-medium text-foreground">Monthly Payouts:</span> Payouts are processed monthly. Net payout = Salary (if eligible) + Call Bonus (if eligible) + Commission earned.</p>
          </div>
        </div>
      </div>

      {/* Monthly Salary Card */}
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> Monthly Salary
        </h3>
        <div className="flex items-center gap-6">
          <div className="rounded-lg bg-primary/10 px-8 py-5 text-center">
            <p className="text-3xl font-bold text-primary">₹{monthlySalary.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Your Monthly Salary</p>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>This salary is set by Admin for your account.</p>
            <p>Eligibility requires meeting the minimum {settings.min_hours_required} hours on duty.</p>
          </div>
        </div>
      </div>

      {/* Commission Rates */}
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Commission Rates (Incentives)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-earning/10 p-4 text-center">
            <p className="text-2xl font-bold text-earning">{rates.direct_rate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Direct (Your FTD)</p>
          </div>
          <div className="rounded-lg bg-info/10 p-4 text-center">
            <p className="text-2xl font-bold text-info">{rates.tier2_rate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Tier 2 (Referral's FTD)</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <p className="text-2xl font-bold text-primary">{rates.tier3_rate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Tier 3 (Referral's Referral)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KPICard
          title="Salary Status"
          value={salaryPayment ? `₹${Number(salaryPayment.total_salary).toLocaleString()}` : `₹${monthlySalary.toLocaleString()}`}
          icon={<CreditCard className="h-5 w-5" />}
          subtitle={salaryPayment ? `${salaryPayment.hours_logged}h logged · ${salaryPayment.calls_made} calls` : 'No salary payment yet'}
        />
        <KPICard
          title="Latest Payout"
          value={payouts[0] ? `₹${Number(payouts[0].net_payout).toLocaleString()}` : '₹0'}
          icon={<DollarSign className="h-5 w-5" />}
          subtitle={payouts[0] ? `${payouts[0].period_start} – ${payouts[0].period_end}` : 'No payouts processed yet'}
        />
        <KPICard
          title="Commission This Period"
          value={`₹${commissions.reduce((sum, c) => sum + Number(c.amount), 0).toLocaleString()}`}
          icon={<TrendingUp className="h-5 w-5" />}
          subtitle={`${commissions.filter(c => c.tier === 'direct').length} direct FTDs`}
        />
      </div>

      {/* Eligibility warnings */}
      {salaryPayment && !salaryPayment.hours_eligible && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm text-warning font-medium">⚠️ Hours Target Not Met — You've logged {salaryPayment.hours_logged}h of the required {settings.min_hours_required}h. Complete {(settings.min_hours_required - salaryPayment.hours_logged).toFixed(0)} more hours to unlock your salary.</p>
        </div>
      )}
      {salaryPayment && !salaryPayment.calls_eligible && (
        <div className="rounded-lg border border-info/30 bg-info/5 p-4">
          <p className="text-sm text-info font-medium">📞 Weekly Calls Target Not Met — You've made {salaryPayment.calls_made} of {settings.min_calls_required} required weekly calls. Make {settings.min_calls_required - salaryPayment.calls_made} more calls to earn the ₹{settings.call_bonus_amount.toLocaleString()} call bonus.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Calculator */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Earnings Calculator</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Slide to see how much you'd earn from a single deposit at current rates</p>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Deposit Amount</span>
                <span className="font-semibold">₹{calcDeposit[0].toLocaleString()}</span>
              </div>
              <Slider value={calcDeposit} onValueChange={setCalcDeposit} min={100} max={10000} step={100} />
            </div>
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Your Earning ({rates.direct_rate}%)</span>
                <span className="text-sm font-semibold text-earning">₹{agentEarning.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Upline Tier 2 ({rates.tier2_rate}%)</span>
                <span className="text-sm font-medium">₹{tier2Earning.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Upline Tier 3 ({rates.tier3_rate}%)</span>
                <span className="text-sm font-medium">₹{tier3Earning.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payout History */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-5 py-3">
            <h3 className="font-semibold">Payout History</h3>
          </div>
          {payouts.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No payout history yet</p>
              <p className="text-xs text-muted-foreground">Your first payout will be processed at the end of the month.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Period</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Commission</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Net</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p: any) => (
                    <tr key={p.id} className="border-b">
                      <td className="px-4 py-2.5">{p.period_start} – {p.period_end}</td>
                      <td className="px-4 py-2.5 text-right">₹{Number(p.commission_earned).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">₹{Number(p.net_payout).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right"><StatusBadge variant={p.status}>{p.status}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Commission Records Detail */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Commission Records</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Individual commission entries from your conversions and referral network activity</p>
        </div>
        {commissions.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No commission records yet</p>
            <p className="text-xs text-muted-foreground">Commissions are generated when you or your referrals convert leads.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tier</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Rate</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c: any) => (
                  <tr key={c.id} className="border-b">
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge variant={c.tier === 'direct' ? 'active' : c.tier === 'tier2' ? 'pending' : 'suspended'}>
                        {c.tier === 'direct' ? 'Direct' : c.tier === 'tier2' ? 'Tier 2' : 'Tier 3'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-2.5 text-right">{c.rate_used}%</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-earning">₹{Number(c.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
