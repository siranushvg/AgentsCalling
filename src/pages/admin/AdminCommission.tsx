import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, HelpCircle, Loader2, DollarSign, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { KPICard } from '@/components/KPICard';

interface CommissionRecord {
  id: string;
  agent_id: string;
  lead_id: string;
  amount: number;
  rate_used: number;
  tier: string;
  tier2_agent_id: string | null;
  tier3_agent_id: string | null;
  created_at: string;
  agent_name?: string;
  converting_agent_name?: string;
  lead_username?: string;
}

export default function AdminCommission() {
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [directRate, setDirectRate] = useState(30);
  const [tier2Rate, setTier2Rate] = useState(5);
  const [tier3Rate, setTier3Rate] = useState(3);
  const [saving, setSaving] = useState(false);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [commissionsLoading, setCommissionsLoading] = useState(true);

  useEffect(() => {
    fetchRates();
    fetchCommissions();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('commission_settings')
      .select('*')
      .order('effective_from', { ascending: false });
    if (data && data.length > 0) {
      setRates(data);
      setDirectRate(data[0].direct_rate);
      setTier2Rate(data[0].tier2_rate);
      setTier3Rate(data[0].tier3_rate);
    }
    setLoading(false);
  };

  const fetchCommissions = async () => {
    setCommissionsLoading(true);

    // Fetch commissions
    const { data: comms } = await supabase
      .from('commissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!comms || comms.length === 0) {
      setCommissions([]);
      setCommissionsLoading(false);
      return;
    }

    // Collect unique agent IDs and lead IDs
    const agentIds = new Set<string>();
    const leadIds = new Set<string>();
    for (const c of comms) {
      agentIds.add(c.agent_id);
      if (c.tier2_agent_id) agentIds.add(c.tier2_agent_id);
      if (c.tier3_agent_id) agentIds.add(c.tier3_agent_id);
      leadIds.add(c.lead_id);
    }

    // Fetch agent names
    const { data: agents } = await supabase
      .from('agents')
      .select('id, full_name')
      .in('id', Array.from(agentIds));
    const agentMap = new Map((agents || []).map(a => [a.id, a.full_name]));

    // Fetch lead usernames
    const { data: leads } = await supabase
      .from('leads')
      .select('id, username')
      .in('id', Array.from(leadIds));
    const leadMap = new Map((leads || []).map(l => [l.id, l.username]));

    const enriched: CommissionRecord[] = comms.map(c => {
      // For tier2/tier3 commissions, the converting agent is stored in tier2_agent_id (for tier2) or tier3_agent_id (for tier3)
      let convertingAgentName = '';
      if (c.tier === 'direct') {
        convertingAgentName = agentMap.get(c.agent_id) || 'Unknown';
      } else if (c.tier === 'tier2') {
        convertingAgentName = agentMap.get(c.tier2_agent_id || '') || 'Unknown';
      } else if (c.tier === 'tier3') {
        convertingAgentName = agentMap.get(c.tier3_agent_id || '') || 'Unknown';
      }

      return {
        ...c,
        agent_name: agentMap.get(c.agent_id) || 'Unknown',
        converting_agent_name: convertingAgentName,
        lead_username: leadMap.get(c.lead_id) || 'Unknown',
      };
    });

    setCommissions(enriched);
    setCommissionsLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('commission_settings').insert({
      direct_rate: directRate,
      tier2_rate: tier2Rate,
      tier3_rate: tier3Rate,
      effective_from: new Date().toISOString().slice(0, 10),
    });
    if (error) {
      toast.error('Failed to save rates');
    } else {
      toast.success('Commission rates updated successfully');
      setEditing(false);
      fetchRates();
    }
    setSaving(false);
  };

  const current = rates[0];
  const totalDirect = commissions.filter(c => c.tier === 'direct').reduce((s, c) => s + Number(c.amount), 0);
  const totalTier2 = commissions.filter(c => c.tier === 'tier2').reduce((s, c) => s + Number(c.amount), 0);
  const totalTier3 = commissions.filter(c => c.tier === 'tier3').reduce((s, c) => s + Number(c.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading rates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tier Explanation */}
      <div className="rounded-lg border bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How commission tiers work</p>
            <p><span className="font-medium text-foreground">Direct Commission:</span> The percentage the agent earns from their own successful conversions (FTDs).</p>
            <p><span className="font-medium text-foreground">Tier 2:</span> The percentage earned from the direct downline / referred agent's conversion activity. When Agent A refers Agent B, Agent A earns Tier 2 on every FTD Agent B converts.</p>
            <p><span className="font-medium text-foreground">Tier 3:</span> The percentage earned from the next referral layer below Tier 2. If Agent B refers Agent C, Agent A earns Tier 3 on Agent C's conversions.</p>
          </div>
        </div>
      </div>

      {/* Current Rates */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Current Active Rates</h3>
          {!editing ? (
            <Button size="sm" onClick={() => setEditing(true)}>Edit Rates</Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); if (current) { setDirectRate(current.direct_rate); setTier2Rate(current.tier2_rate); setTier3Rate(current.tier3_rate); } }}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Rates
              </Button>
            </div>
          )}
        </div>

        {!editing ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-earning/10 p-4 text-center">
              <p className="text-3xl font-bold text-earning">{current?.direct_rate || 30}%</p>
              <p className="text-sm text-muted-foreground mt-1">Direct</p>
              <p className="text-xs text-muted-foreground">Agent's own FTD</p>
            </div>
            <div className="rounded-lg bg-info/10 p-4 text-center">
              <p className="text-3xl font-bold text-info">{current?.tier2_rate || 5}%</p>
              <p className="text-sm text-muted-foreground mt-1">Tier 2</p>
              <p className="text-xs text-muted-foreground">Referral's FTD</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-4 text-center">
              <p className="text-3xl font-bold text-primary">{current?.tier3_rate || 3}%</p>
              <p className="text-sm text-muted-foreground mt-1">Tier 3</p>
              <p className="text-xs text-muted-foreground">Referral's referral</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Direct Commission %</label>
              <Input type="number" value={directRate} onChange={e => setDirectRate(Number(e.target.value))} min={0} max={100} />
              <p className="text-xs text-muted-foreground">Agent's own conversion</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tier 2 %</label>
              <Input type="number" value={tier2Rate} onChange={e => setTier2Rate(Number(e.target.value))} min={0} max={100} />
              <p className="text-xs text-muted-foreground">Direct referral's conversion</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tier 3 %</label>
              <Input type="number" value={tier3Rate} onChange={e => setTier3Rate(Number(e.target.value))} min={0} max={100} />
              <p className="text-xs text-muted-foreground">Referral's referral</p>
            </div>
          </div>
        )}
      </div>

      {/* Commission Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard
          title="Direct Commission"
          value={`₹${totalDirect.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
          subtitle={`${commissions.filter(c => c.tier === 'direct').length} records`}
        />
        <KPICard
          title="Tier 2 Commission"
          value={`₹${totalTier2.toLocaleString()}`}
          icon={<Users className="h-5 w-5" />}
          subtitle={`${commissions.filter(c => c.tier === 'tier2').length} records`}
        />
        <KPICard
          title="Tier 3 Commission"
          value={`₹${totalTier3.toLocaleString()}`}
          icon={<TrendingUp className="h-5 w-5" />}
          subtitle={`${commissions.filter(c => c.tier === 'tier3').length} records`}
        />
      </div>

      {/* Commission Records */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Commission Records</h3>
          <p className="text-xs text-muted-foreground mt-0.5">All commission entries with referral chain traceability</p>
        </div>
        {commissionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : commissions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No commission records yet</p>
            <p className="text-xs text-muted-foreground mt-1">Commission records are created when agents convert leads (FTD events).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Earning Agent</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tier</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Converting Agent</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Lead</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Rate</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 font-medium">{c.agent_name}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge variant={c.tier === 'direct' ? 'active' : c.tier === 'tier2' ? 'pending' : 'suspended'}>
                        {c.tier === 'direct' ? 'Direct' : c.tier === 'tier2' ? 'Tier 2' : 'Tier 3'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {c.tier === 'direct' ? '—' : c.converting_agent_name}
                    </td>
                    <td className="px-4 py-2.5">{c.lead_username}</td>
                    <td className="px-4 py-2.5 text-right">{c.rate_used}%</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-earning">₹{Number(c.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rate History */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Rate Change History</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Effective From</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Direct</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Tier 2</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Tier 3</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Created</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((cs: any) => (
              <tr key={cs.id} className="border-b">
                <td className="px-4 py-2.5">{cs.effective_from}</td>
                <td className="px-4 py-2.5 text-center font-medium">{cs.direct_rate}%</td>
                <td className="px-4 py-2.5 text-center">{cs.tier2_rate}%</td>
                <td className="px-4 py-2.5 text-center">{cs.tier3_rate}%</td>
                <td className="px-4 py-2.5">{new Date(cs.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {rates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No rate history yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}