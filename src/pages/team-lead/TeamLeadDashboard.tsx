import React, { useState } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { DetailDrawer } from '@/components/DetailDrawer';
import { mockAgents, mockCalls, mockLowActivityFlags, todayKPIs, getTeamAgents } from '@/data/mockData';
import { Users, Phone, Target, Headphones, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const hourlyData = [
  { hour: '9am', dials: 18, ftds: 1 },
  { hour: '10am', dials: 32, ftds: 2 },
  { hour: '11am', dials: 28, ftds: 3 },
  { hour: '12pm', dials: 22, ftds: 1 },
  { hour: '1pm', dials: 35, ftds: 4 },
  { hour: '2pm', dials: 30, ftds: 2 },
  { hour: '3pm', dials: 25, ftds: 1 },
  { hour: '4pm', dials: 15, ftds: 0 },
];

const languagePerf = [
  { language: 'Hindi', value: 45 },
  { language: 'English', value: 25 },
  { language: 'Tamil', value: 12 },
  { language: 'Telugu', value: 8 },
  { language: 'Others', value: 10 },
];

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--muted-foreground))',
];

export default function TeamLeadDashboard() {
  const teamAgents = getTeamAgents('tl1');
  const activeCalls = mockCalls.filter(c => c.status === 'connected' || c.status === 'ringing');
  const unresolvedFlags = mockLowActivityFlags.filter(f => !f.resolved);
  const [selectedAgent, setSelectedAgent] = useState<typeof mockAgents[0] | null>(null);

  const handleAvatarClick = (name: string) => {
    const agent = [...mockAgents, ...teamAgents].find(a => a.full_name === name);
    if (agent) setSelectedAgent(agent);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Team Agents" value={teamAgents.length} icon={<Users className="h-5 w-5" />} subtitle={`${teamAgents.filter(a => a.status === 'active').length} active`} avatars={teamAgents.filter(a => a.status === 'active').map(a => a.full_name)} onAvatarClick={handleAvatarClick} />
        <KPICard title="Team Dials Today" value={148} icon={<Phone className="h-5 w-5" />} trend={{ value: 8, positive: true }} />
        <KPICard title="Team FTDs" value={9} icon={<Target className="h-5 w-5" />} trend={{ value: 15, positive: true }} />
        <KPICard title="Active Calls" value={activeCalls.length} icon={<Headphones className="h-5 w-5" />} subtitle="Live now" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Agent Status Grid */}
        <div className="col-span-2 rounded-lg border bg-card shadow-sm">
          <div className="border-b px-5 py-3">
            <h3 className="font-semibold">Team Agent Status</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Agent</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Dials</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">FTDs</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Active Hrs</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">MG</th>
              </tr>
            </thead>
            <tbody>
              {teamAgents.map((agent, i) => (
                <tr key={agent.id} className="border-b hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {agent.full_name.charAt(0)}
                      </div>
                      <span className="font-medium">{agent.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center"><StatusBadge variant={agent.status}>{agent.status}</StatusBadge></td>
                  <td className="px-4 py-2.5 text-center font-medium">{[42, 38, 25, 31][i % 4]}</td>
                  <td className="px-4 py-2.5 text-center font-medium">{[3, 2, 1, 3][i % 4]}</td>
                  <td className="px-4 py-2.5 text-center">{[5.2, 4.8, 6.1, 3.9][i % 4]}h</td>
                  <td className="px-4 py-2.5 text-center">
                    <StatusBadge variant={(['eligible', 'at_risk', 'eligible', 'not_eligible'] as const)[i % 4]}>
                      {['eligible', 'at risk', 'eligible', 'not eligible'][i % 4]}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Alerts */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-5 py-3 flex items-center justify-between">
            <h3 className="font-semibold">Alerts</h3>
            <span className="text-xs bg-destructive/15 text-destructive px-2 py-0.5 rounded-full font-medium">{unresolvedFlags.length}</span>
          </div>
          <div className="divide-y">
            {unresolvedFlags.map(flag => (
              <div key={flag.id} className="px-5 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{flag.agent_name}</p>
                    <p className="text-xs text-muted-foreground">{flag.details}</p>
                    <StatusBadge variant={flag.severity} className="mt-1">{flag.severity}</StatusBadge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Hourly Activity */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4">Hourly Team Activity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="dials" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Dials" />
              <Bar dataKey="ftds" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} name="FTDs" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Language Distribution */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4">FTDs by Language</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={languagePerf}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  nameKey="language"
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                >
                  {languagePerf.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {languagePerf.map((item, i) => (
              <div key={item.language} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                <span className="text-muted-foreground">{item.language}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Calls */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Active Calls</h3>
        </div>
        {activeCalls.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Agent</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Lead</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Duration</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeCalls.map(call => (
                <tr key={call.id} className="border-b">
                  <td className="px-4 py-2.5 font-medium">{mockAgents.find(a => a.id === call.agent_id)?.full_name}</td>
                  <td className="px-4 py-2.5">{call.lead_username}</td>
                  <td className="px-4 py-2.5 text-center"><StatusBadge variant={call.status as any}>{call.status}</StatusBadge></td>
                  <td className="px-4 py-2.5 text-center font-mono">{Math.floor(call.duration_seconds / 60)}:{(call.duration_seconds % 60).toString().padStart(2, '0')}</td>
                  <td className="px-4 py-2.5 text-right space-x-1">
                    <button className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors">Listen</button>
                    <button className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors">Whisper</button>
                    <button className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors">Barge</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">No active calls right now</div>
        )}
      </div>
      {/* Agent Profile Drawer */}
      <DetailDrawer open={!!selectedAgent} onClose={() => setSelectedAgent(null)} title={selectedAgent?.full_name || ''} subtitle={selectedAgent?.role}>
        {selectedAgent && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                {selectedAgent.full_name.split(' ').map(w => w[0]).join('').toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-semibold">{selectedAgent.full_name}</h2>
                <p className="text-sm text-muted-foreground">{selectedAgent.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">City</p>
                <p className="text-sm font-medium">{selectedAgent.city}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge variant={selectedAgent.status}>{selectedAgent.status}</StatusBadge>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Referral Code</p>
                <p className="text-sm font-medium font-mono">{selectedAgent.referral_code}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Training</p>
                <p className="text-sm font-medium">{selectedAgent.training_completed ? 'Completed' : `${selectedAgent.training_progress}/6 modules`}</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Languages</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgent.languages.map(lang => (
                  <span key={lang} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{lang}</span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Joined</p>
              <p className="text-sm font-medium">{new Date(selectedAgent.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
