import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DetailDrawer } from '@/components/DetailDrawer';
import { Megaphone, Plus, Users, Phone, Target, BarChart3, Play, Pause, StopCircle, Settings, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  max_attempts: number;
  active_hours_start: string;
  active_hours_end: string;
  script_template: string | null;
  start_date: string;
  end_date: string | null;
  distribution_strategy: string;
  status: string;
  total_users: number;
  assigned_count: number;
  completed_count: number;
  converted_count: number;
  created_at: string;
}

interface Agent {
  id: string;
  full_name: string;
  status: string;
  languages: string[];
}

export default function AdminCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMaxAttempts, setFormMaxAttempts] = useState('3');
  const [formStartTime, setFormStartTime] = useState('10:00');
  const [formEndTime, setFormEndTime] = useState('21:00');
  const [formDistribution, setFormDistribution] = useState('equal_split');
  const [formScript, setFormScript] = useState('');
  const [formStartDate, setFormStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formEndDate, setFormEndDate] = useState('');

  const loadData = async () => {
    const [{ data: camps }, { data: agts }] = await Promise.all([
      supabase.from('call_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('agents').select('id, full_name, status, languages').eq('status', 'active'),
    ]);
    setCampaigns((camps as Campaign[]) || []);
    setAgents((agts as Agent[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    if (!formName.trim()) { toast.error('Campaign name required'); return; }

    // Create queue first
    const { data: queue, error: qErr } = await supabase.from('call_queues').insert({
      name: `${formName} Queue`,
      type: 'campaign',
      status: 'active',
    }).select().single();

    if (qErr) { toast.error('Failed to create queue'); return; }

    const { error } = await supabase.from('call_campaigns').insert({
      name: formName,
      description: formDesc || null,
      queue_id: queue.id,
      max_attempts: parseInt(formMaxAttempts) || 3,
      active_hours_start: formStartTime,
      active_hours_end: formEndTime,
      distribution_strategy: formDistribution,
      script_template: formScript || null,
      start_date: formStartDate,
      end_date: formEndDate || null,
      status: 'draft',
      created_by: user?.id,
    });

    if (error) { toast.error('Failed to create'); return; }
    toast.success('Campaign created');
    setShowCreate(false);
    resetForm();
    loadData();
  };

  const resetForm = () => {
    setFormName(''); setFormDesc(''); setFormMaxAttempts('3');
    setFormStartTime('10:00'); setFormEndTime('21:00');
    setFormDistribution('equal_split'); setFormScript('');
    setFormStartDate(format(new Date(), 'yyyy-MM-dd')); setFormEndDate('');
  };

  const toggleStatus = async (camp: Campaign, newStatus: string) => {
    await supabase.from('call_campaigns').update({ status: newStatus }).eq('id', camp.id);
    toast.success(`Campaign ${newStatus}`);
    loadData();
  };

  const assignAgents = async (campaignId: string, agentIds: string[]) => {
    const inserts = agentIds.map(agent_id => ({ campaign_id: campaignId, agent_id }));
    await supabase.from('campaign_agents').insert(inserts);
    toast.success(`${agentIds.length} agents assigned`);
    setShowAssign(false);
    loadData();
  };

  const addLeadsFromImport = async (campaignId: string, campaign: Campaign) => {
    // Get unassigned new leads and add them to the campaign queue
    const { data: leads } = await supabase
      .from('leads')
      .select('id')
      .eq('status', 'new')
      .eq('suppressed', false)
      .is('assigned_agent_id', null)
      .limit(500);

    if (!leads?.length) { toast.info('No eligible leads found'); return; }

    // Get campaign agents for distribution
    const { data: campAgents } = await supabase
      .from('campaign_agents')
      .select('agent_id')
      .eq('campaign_id', campaignId)
      .eq('status', 'active');

    const agentIds = campAgents?.map(a => a.agent_id) || [];

    // Get the queue_id from campaign
    const { data: camp } = await supabase
      .from('call_campaigns')
      .select('queue_id')
      .eq('id', campaignId)
      .single();

    if (!camp?.queue_id) { toast.error('No queue found'); return; }

    // Insert queue members with round-robin distribution
    const members = leads.map((l, i) => ({
      queue_id: camp.queue_id,
      lead_id: l.id,
      campaign_id: campaignId,
      priority_score: 50,
      position: i,
      assigned_agent_id: agentIds.length ? agentIds[i % agentIds.length] : null,
    }));

    const { error } = await supabase.from('call_queue_members').insert(members);
    if (error) { toast.error('Failed to add leads'); return; }

    await supabase.from('call_campaigns').update({
      total_users: (campaign.total_users || 0) + leads.length,
      assigned_count: agentIds.length ? (campaign.assigned_count || 0) + leads.length : campaign.assigned_count,
    }).eq('id', campaignId);

    toast.success(`${leads.length} leads added to campaign`);
    loadData();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'bg-success/10 text-success border-success/20';
      case 'paused': return 'bg-warning/10 text-warning border-warning/20';
      case 'completed': return 'bg-muted text-muted-foreground';
      default: return 'bg-info/10 text-info border-info/20';
    }
  };

  // Stats
  const active = campaigns.filter(c => c.status === 'active').length;
  const totalUsers = campaigns.reduce((s, c) => s + c.total_users, 0);
  const totalConverted = campaigns.reduce((s, c) => s + c.converted_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaign Management</h1>
          <p className="text-sm text-muted-foreground">Create and manage outbound calling campaigns</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Campaign Name</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. March Reactivation" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Campaign purpose..." className="resize-none h-16" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Max Attempts</Label>
                  <Input type="number" value={formMaxAttempts} onChange={e => setFormMaxAttempts(e.target.value)} />
                </div>
                <div>
                  <Label>Distribution</Label>
                  <Select value={formDistribution} onValueChange={setFormDistribution}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equal_split">Equal Split</SelectItem>
                      <SelectItem value="skill_based">Skill-Based</SelectItem>
                      <SelectItem value="language_based">Language-Based</SelectItem>
                      <SelectItem value="load_balance">Load Balance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Active Hours Start</Label>
                  <Input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} />
                </div>
                <div>
                  <Label>Active Hours End</Label>
                  <Input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>End Date (optional)</Label>
                  <Input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Call Script Template</Label>
                <Textarea value={formScript} onChange={e => setFormScript(e.target.value)} placeholder="Script for agents..." className="resize-none h-20" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create Campaign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div><p className="text-2xl font-bold">{campaigns.length}</p><p className="text-xs text-muted-foreground">Total Campaigns</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Play className="h-5 w-5 text-success" />
            </div>
            <div><p className="text-2xl font-bold">{active}</p><p className="text-xs text-muted-foreground">Active</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-info" />
            </div>
            <div><p className="text-2xl font-bold">{totalUsers}</p><p className="text-xs text-muted-foreground">Total Users</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-earning/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-earning" />
            </div>
            <div><p className="text-2xl font-bold">{totalConverted}</p><p className="text-xs text-muted-foreground">Converted</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Completed</TableHead>
                <TableHead className="text-center">Converted</TableHead>
                <TableHead className="text-center">Rate</TableHead>
                <TableHead>Active Hours</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    No campaigns yet. Create your first campaign to get started.
                  </TableCell>
                </TableRow>
              ) : campaigns.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedCampaign(c)}>
                  <TableCell>
                    <p className="font-medium text-sm">{c.name}</p>
                    {c.description && <p className="text-xs text-muted-foreground truncate max-w-48">{c.description}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[10px]', statusColor(c.status))}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{c.distribution_strategy.replace('_', ' ')}</TableCell>
                  <TableCell className="text-center font-medium">{c.total_users}</TableCell>
                  <TableCell className="text-center">{c.completed_count}</TableCell>
                  <TableCell className="text-center font-medium text-earning">{c.converted_count}</TableCell>
                  <TableCell className="text-center text-xs">
                    {c.total_users ? `${Math.round((c.converted_count / c.total_users) * 100)}%` : '—'}
                  </TableCell>
                  <TableCell className="text-xs">{c.active_hours_start}–{c.active_hours_end}</TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      {c.status === 'draft' && (
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => toggleStatus(c, 'active')}>
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      {c.status === 'active' && (
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => toggleStatus(c, 'paused')}>
                          <Pause className="h-3 w-3" />
                        </Button>
                      )}
                      {c.status === 'paused' && (
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => toggleStatus(c, 'active')}>
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setSelectedCampaign(c); setShowAssign(true); }}>
                        <Users className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => addLeadsFromImport(c.id, c)}>
                        <Target className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Campaign Detail Drawer */}
      <DetailDrawer
        open={!!selectedCampaign && !showAssign}
        onClose={() => setSelectedCampaign(null)}
        title={selectedCampaign?.name || ''}
        subtitle="Campaign Details"
      >
        {selectedCampaign && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-2xl font-bold">{selectedCampaign.total_users}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-2xl font-bold">{selectedCampaign.completed_count}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-2xl font-bold text-earning">{selectedCampaign.converted_count}</p>
                <p className="text-xs text-muted-foreground">Converted</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-2xl font-bold">
                  {selectedCampaign.total_users ? `${Math.round((selectedCampaign.converted_count / selectedCampaign.total_users) * 100)}%` : '0%'}
                </p>
                <p className="text-xs text-muted-foreground">Conv. Rate</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline" className={statusColor(selectedCampaign.status)}>{selectedCampaign.status}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Max Attempts</span><span>{selectedCampaign.max_attempts}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Distribution</span><span>{selectedCampaign.distribution_strategy}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Active Hours</span><span>{selectedCampaign.active_hours_start}–{selectedCampaign.active_hours_end}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span>{selectedCampaign.start_date}</span></div>
              {selectedCampaign.end_date && <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span>{selectedCampaign.end_date}</span></div>}
            </div>

            {selectedCampaign.description && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{selectedCampaign.description}</p>
              </div>
            )}

            {selectedCampaign.script_template && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Script Template</p>
                <p className="text-sm bg-muted rounded p-2 whitespace-pre-wrap">{selectedCampaign.script_template}</p>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      {/* Agent Assignment Dialog */}
      <AgentAssignDialog
        open={showAssign}
        onClose={() => setShowAssign(false)}
        agents={agents}
        campaignId={selectedCampaign?.id || ''}
        onAssign={assignAgents}
      />
    </div>
  );
}

function AgentAssignDialog({ open, onClose, agents, campaignId, onAssign }: {
  open: boolean; onClose: () => void; agents: Agent[]; campaignId: string;
  onAssign: (campaignId: string, agentIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Agents to Campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {agents.map(a => (
            <button
              key={a.id}
              onClick={() => toggle(a.id)}
              className={cn(
                'w-full text-left rounded-md border p-3 transition-all',
                selected.has(a.id) ? 'border-primary bg-primary/5' : 'hover:bg-accent'
              )}
            >
              <p className="text-sm font-medium">{a.full_name}</p>
              <p className="text-xs text-muted-foreground">{a.languages.join(', ')}</p>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={selected.size === 0} onClick={() => onAssign(campaignId, Array.from(selected))}>
            Assign {selected.size} Agent{selected.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
