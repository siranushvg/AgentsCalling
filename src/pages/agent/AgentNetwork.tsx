import React, { useState, useEffect } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { KPICard } from '@/components/KPICard';
import { Copy, Users, DollarSign, Network, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NetworkAgent {
  id: string;
  full_name: string;
  status: string;
  tier: string;
}

export default function AgentNetwork() {
  const { user } = useAuth();
  const [refCode, setRefCode] = useState('');
  const [tier2, setTier2] = useState<NetworkAgent[]>([]);
  const [tier3, setTier3] = useState<NetworkAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchNetworkData();
  }, [user]);

  const fetchNetworkData = async () => {
    if (!user) return;
    setLoading(true);

    // Get logged-in agent's referral code and ID
    const { data: agentData } = await supabase
      .from('agents')
      .select('id, referral_code')
      .eq('user_id', user.id)
      .single();

    if (agentData) {
      setRefCode(agentData.referral_code);

      // Use RPC function to get network (bypasses RLS)
      const { data: networkData } = await supabase.rpc('get_referral_network', {
        _agent_id: agentData.id,
      });

      const all = (networkData || []) as NetworkAgent[];
      setTier2(all.filter(a => a.tier === 'tier2'));
      setTier3(all.filter(a => a.tier === 'tier3'));
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Referral Code */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold mb-1">Your Referral Code</h3>
            <p className="text-sm text-muted-foreground">Share this code with people who'd make great agents. When they sign up and convert leads, you earn passive commission — 5% Tier 2 (from your direct referrals' conversions), 3% Tier 3 (from your referrals' referrals' conversions) on every FTD.</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="rounded-lg bg-muted px-4 py-2 text-lg font-mono font-bold tracking-wider">{refCode}</code>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(refCode); toast.success('Referral code copied!'); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="rounded-lg border bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <UserPlus className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">How referral earnings work</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              <strong>Direct Commission:</strong> Earned from your own successful conversions.<br />
              <strong>Tier 2 (5%):</strong> Earned from the activity of agents directly under your referral network. When someone signs up using your referral code and converts a lead, you earn 5% of that FTD — passively.<br />
              <strong>Tier 3 (3%):</strong> Earned from the next referral layer below Tier 2. If your referral refers someone else who also converts, you earn 3%.<br />
              These earnings are passive and paid alongside your regular commission in monthly payouts.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard title="Tier 2 Referrals" value={tier2.length} icon={<Users className="h-5 w-5" />} subtitle="Direct referrals" />
        <KPICard title="Tier 3 Referrals" value={tier3.length} icon={<Network className="h-5 w-5" />} subtitle="Referrals' referrals" />
        <KPICard title="Total Network" value={tier2.length + tier3.length} icon={<DollarSign className="h-5 w-5" />} subtitle="All network agents" />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-2 gap-6">
        {[{ label: 'Tier 2', data: tier2, rate: '5%', desc: 'Agents who signed up using your referral code' }, { label: 'Tier 3', data: tier3, rate: '3%', desc: 'Agents referred by your Tier 2 referrals' }].map(({ label, data, rate, desc }) => (
          <div key={label} className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-5 py-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{label} Network</h3>
                <span className="text-xs text-muted-foreground">{rate} per FTD</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            {data.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No {label.toLowerCase()} referrals yet</p>
                <p className="text-xs text-muted-foreground">Share your referral code with qualified agents to start building your network.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(m => (
                    <tr key={m.id} className="border-b">
                      <td className="px-4 py-2.5 font-medium">{m.full_name}</td>
                      <td className="px-4 py-2.5 text-right"><StatusBadge variant={m.status as any}>{m.status}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
