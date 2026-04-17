import React, { useState } from 'react';
import { mockActivityLog } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { KPICard } from '@/components/KPICard';
import { DetailDrawer } from '@/components/DetailDrawer';
import { exportToCSV } from '@/lib/exportCSV';
import { Shield, AlertTriangle, Eye, Download, Search, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const fraudAlerts = [
  { id: 'f1', type: 'Unusual FTD spike', agent: 'Amit Joshi', agentId: 'a7', details: '5 FTDs in 30 minutes', severity: 'high' as const, timestamp: '2026-03-17T14:30:00', commissionHeld: 17500 },
  { id: 'f2', type: 'Concurrent login', agent: 'Priya Patel', agentId: 'a2', details: 'Login from 2 different IPs simultaneously', severity: 'medium' as const, timestamp: '2026-03-17T11:45:00', commissionHeld: 0 },
  { id: 'f3', type: '0-second calls marked contacted', agent: 'Ananya Das', agentId: 'a4', details: '3 calls with 0 duration marked as contacted', severity: 'high' as const, timestamp: '2026-03-17T10:20:00', commissionHeld: 5250 },
];

export default function AdminAudit() {
  const [selectedAlert, setSelectedAlert] = useState<typeof fraudAlerts[0] | null>(null);
  const [search, setSearch] = useState('');
  const [holdingCommission, setHoldingCommission] = useState<Set<string>>(new Set());

  const filteredLogs = mockActivityLog.filter(log =>
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.details?.toLowerCase().includes(search.toLowerCase())
  );

  const handleHoldCommission = (alertId: string) => {
    setHoldingCommission(prev => new Set(prev).add(alertId));
    toast.success('Commission held pending investigation. Logged to audit.');
  };

  const handleExportLogs = () => {
    exportToCSV(
      mockActivityLog.map(l => ({
        Time: new Date(l.created_at).toLocaleString(),
        Actor_Role: l.actor_role,
        Action: l.action,
        Target: l.target_type,
        Details: l.details || '',
      })),
      'audit_log'
    );
    toast.success('Audit log exported');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Fraud Alerts" value={fraudAlerts.length} icon={<AlertTriangle className="h-5 w-5" />} subtitle="Pending review" />
        <KPICard title="Audit Entries Today" value={mockActivityLog.length} icon={<Shield className="h-5 w-5" />} />
        <KPICard title="Commissions Held" value={`₹${fraudAlerts.reduce((s, a) => s + a.commissionHeld, 0).toLocaleString()}`} icon={<Lock className="h-5 w-5" />} subtitle="Under investigation" />
        <KPICard title="Resolved Today" value={0} icon={<Eye className="h-5 w-5" />} />
      </div>

      {/* Fraud Alerts */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Fraud Detection Alerts</h3>
        </div>
        <div className="divide-y">
          {fraudAlerts.map(alert => (
            <div key={alert.id} className="px-5 py-3 flex items-center justify-between hover:bg-accent/30 cursor-pointer" onClick={() => setSelectedAlert(alert)}>
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-4 w-4 ${alert.severity === 'high' ? 'text-destructive' : 'text-warning'}`} />
                <div>
                  <p className="text-sm font-medium">{alert.type}: {alert.agent}</p>
                  <p className="text-xs text-muted-foreground">{alert.details}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {alert.commissionHeld > 0 && (
                  <span className="text-xs font-medium text-destructive">₹{alert.commissionHeld.toLocaleString()} at risk</span>
                )}
                <StatusBadge variant={alert.severity}>{alert.severity}</StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Log */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <h3 className="font-semibold">Activity Log (Append-Only)</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input type="text" placeholder="Filter logs..." value={search} onChange={e => setSearch(e.target.value)}
                className="rounded-md border bg-background pl-8 pr-3 py-1.5 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <Button variant="outline" size="sm" onClick={handleExportLogs}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export
            </Button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Time</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actor</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Action</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <tr key={log.id} className="border-b">
                <td className="px-4 py-2.5 text-xs font-mono">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge variant={log.actor_role === 'admin' ? 'active' : log.actor_role === 'team_lead' ? 'assigned' : 'new'}>
                    {log.actor_role}
                  </StatusBadge>
                </td>
                <td className="px-4 py-2.5 font-medium">{log.action}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fraud Alert Detail Drawer */}
      <DetailDrawer
        open={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title={selectedAlert?.type || ''}
        subtitle={selectedAlert?.agent}
      >
        {selectedAlert && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-muted-foreground">Severity</p><StatusBadge variant={selectedAlert.severity}>{selectedAlert.severity}</StatusBadge></div>
              <div><p className="text-xs text-muted-foreground">Timestamp</p><p className="text-sm font-mono">{new Date(selectedAlert.timestamp).toLocaleString()}</p></div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Details</p>
              <p className="text-sm">{selectedAlert.details}</p>
            </div>
            {selectedAlert.commissionHeld > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">Commission at Risk: ₹{selectedAlert.commissionHeld.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Hold commission while investigation is ongoing</p>
              </div>
            )}
            <div className="flex gap-2 pt-4 border-t">
              {!holdingCommission.has(selectedAlert.id) && selectedAlert.commissionHeld > 0 && (
                <Button variant="destructive" size="sm" onClick={() => handleHoldCommission(selectedAlert.id)}>
                  <Lock className="h-4 w-4 mr-1" /> Hold Commission
                </Button>
              )}
              {holdingCommission.has(selectedAlert.id) && (
                <StatusBadge variant="terminated">Commission Held</StatusBadge>
              )}
              <Button variant="outline" size="sm" onClick={() => toast.success('Alert marked as resolved')}>
                Resolve Alert
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
