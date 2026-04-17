import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Network, Loader2 } from 'lucide-react';

interface Props {
  agentId: string;
}

interface NetworkAgent {
  id: string;
  full_name: string;
  status: string;
  tier: string;
}

export function AdminAgentNetworkSection({ agentId }: Props) {
  const [network, setNetwork] = useState<NetworkAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.rpc('get_referral_network', { _agent_id: agentId });
      setNetwork((data || []) as NetworkAgent[]);
      setLoading(false);
    };
    fetch();
  }, [agentId]);

  const tier2 = network.filter(a => a.tier === 'tier2');
  const tier3 = network.filter(a => a.tier === 'tier3');

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
        <Network className="h-3.5 w-3.5" /> REFERRAL NETWORK
      </h4>
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : network.length === 0 ? (
        <p className="text-sm text-muted-foreground">No referrals in network</p>
      ) : (
        <div className="space-y-2">
          {tier2.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Tier 2 ({tier2.length})</p>
              {tier2.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border p-2 mb-1">
                  <span className="text-sm font-medium">{a.full_name}</span>
                  <StatusBadge variant={a.status as any}>{a.status}</StatusBadge>
                </div>
              ))}
            </div>
          )}
          {tier3.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Tier 3 ({tier3.length})</p>
              {tier3.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border p-2 mb-1">
                  <span className="text-sm font-medium">{a.full_name}</span>
                  <StatusBadge variant={a.status as any}>{a.status}</StatusBadge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
