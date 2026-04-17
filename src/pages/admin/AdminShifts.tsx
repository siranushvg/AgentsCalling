import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, Save, Calendar, UserCog, Sun, Clock, Moon, Wrench, X, Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  useShiftTemplates, useAgentShifts, useActiveAgents,
  useUpsertShift, useBulkAssignShifts, useDeleteShift,
  formatDate, getWeekDates, DAY_LABELS,
  type AgentShiftRow, type ShiftTemplateRow,
} from '@/hooks/useShiftData';
import { cn } from '@/lib/utils';
import { DetailDrawer } from '@/components/DetailDrawer';
import { StatusBadge } from '@/components/StatusBadge';

const shiftIcons: Record<string, React.ElementType> = { morning: Sun, afternoon: Clock, evening: Moon, custom: Wrench };
const shiftColors: Record<string, string> = {
  morning: 'bg-warning/15 text-warning border-warning/30',
  afternoon: 'bg-info/15 text-info border-info/30',
  evening: 'bg-primary/15 text-primary border-primary/30',
  custom: 'bg-muted text-muted-foreground border-border',
};

export default function AdminShifts() {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const startDate = formatDate(weekDates[0]);
  const endDate = formatDate(weekDates[6]);

  const { data: templates = [], isLoading: loadingTemplates } = useShiftTemplates();
  const { data: shifts = [], isLoading: loadingShifts } = useAgentShifts(startDate, endDate);
  const { data: agents = [], isLoading: loadingAgents } = useActiveAgents();
  const upsertShift = useUpsertShift();
  const bulkAssign = useBulkAssignShifts();
  const deleteShift = useDeleteShift();

  const [agentSearch, setAgentSearch] = useState('');

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editAgentId, setEditAgentId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editShiftId, setEditShiftId] = useState('');
  const [editIsOff, setEditIsOff] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editExistingId, setEditExistingId] = useState<string | undefined>();

  // Bulk assign modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAgentIds, setBulkAgentIds] = useState<string[]>([]);
  const [bulkShiftId, setBulkShiftId] = useState('');

  // Weekday indices: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4 (Sat=5, Sun=6 are always working)
  const WEEKDAY_INDICES = [0, 1, 2, 3, 4]; // Mon-Fri only

  // Compute auto-distributed off-days: round-robin across weekdays, no Sat/Sun off
  const bulkOffDayMap = useMemo(() => {
    const map: Record<string, number> = {}; // agentId -> dayIndex for off
    bulkAgentIds.forEach((id, idx) => {
      map[id] = WEEKDAY_INDICES[idx % WEEKDAY_INDICES.length];
    });
    return map;
  }, [bulkAgentIds]);

  const isLoading = loadingTemplates || loadingShifts || loadingAgents;

  const filteredAgents = useMemo(() => {
    if (!agentSearch.trim()) return agents;
    const q = agentSearch.toLowerCase();
    return agents.filter(a => a.full_name.toLowerCase().includes(q));
  }, [agents, agentSearch]);

  // Build agent shift map: agentId -> date -> shift
  const shiftMap = useMemo(() => {
    const map: Record<string, Record<string, AgentShiftRow>> = {};
    for (const s of shifts) {
      if (!map[s.agent_id]) map[s.agent_id] = {};
      map[s.agent_id][s.date] = s;
    }
    return map;
  }, [shifts]);

  const openEdit = (agentId: string, date: string) => {
    const existing = shiftMap[agentId]?.[date];
    setEditAgentId(agentId);
    setEditDate(date);
    setEditShiftId(existing?.shift_template_id || (templates[0]?.id || ''));
    setEditIsOff(existing?.is_off_day || false);
    setEditReason(existing?.override_reason || '');
    setEditExistingId(existing?.id);
    setEditOpen(true);
  };

  const handleSaveShift = () => {
    if (!editAgentId || !editDate || !editShiftId) return;
    upsertShift.mutate({
      agent_id: editAgentId,
      shift_template_id: editShiftId,
      date: editDate,
      is_off_day: editIsOff,
      override_reason: editReason || undefined,
      existingId: editExistingId,
    }, { onSuccess: () => setEditOpen(false) });
  };

  const handleBulkAssign = () => {
    if (bulkAgentIds.length === 0 || !bulkShiftId) return;
    const shiftsToCreate = bulkAgentIds.flatMap(agentId => {
      const offDayIdx = bulkOffDayMap[agentId];
      return weekDates.map((d, i) => ({
        agent_id: agentId,
        shift_template_id: bulkShiftId,
        date: formatDate(d),
        is_off_day: i === offDayIdx,
      }));
    });
    bulkAssign.mutate(shiftsToCreate, { onSuccess: () => { setBulkOpen(false); setBulkAgentIds([]); } });
  };

  const today = formatDate(new Date());

  const weekLabel = `${weekDates[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekDates[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Manage agent shifts and rosters</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Calendar className="h-4 w-4 mr-2" /> Assign Weekly Roster
          </Button>
        </div>
      </div>

      {/* Shift Templates Summary */}
      <div className="grid grid-cols-4 gap-3">
        {templates.map(t => {
          const Icon = shiftIcons[t.type] || Wrench;
          const color = shiftColors[t.type] || shiftColors.custom;
          return (
            <div key={t.id} className={cn('rounded-lg border p-3', color.split(' ')[0])}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn('h-4 w-4', color.split(' ')[1])} />
                <span className="text-sm font-semibold">{t.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.start_time} – {t.end_time} IST</p>
            </div>
          );
        })}
      </div>

      {/* Week Navigation */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-sm">Weekly Roster</h3>
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search agent..."
                value={agentSearch}
                onChange={e => setAgentSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} className="text-xs">
              This Week
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">{weekLabel}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Loading roster...</div>
        ) : filteredAgents.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            {agentSearch ? `No agents matching "${agentSearch}"` : 'No active agents found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[200px] sticky left-0 bg-muted/30">Agent</th>
                  {weekDates.map((d, i) => {
                    const dateStr = formatDate(d);
                    const isToday = dateStr === today;
                    return (
                      <th key={i} className={cn(
                        'text-center px-2 py-2.5 font-semibold text-xs uppercase tracking-wider min-w-[120px]',
                        isToday ? 'text-primary bg-primary/5' : 'text-muted-foreground'
                      )}>
                        <div>{DAY_LABELS[i]}</div>
                        <div className="text-[10px] font-normal mt-0.5">{d.getDate()}/{d.getMonth() + 1}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAgents.map(agent => (
                  <tr key={agent.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2.5 sticky left-0 bg-card">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                          {agent.full_name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-medium text-xs leading-tight">{agent.full_name}</p>
                          <p className="text-[10px] text-muted-foreground">{agent.city}</p>
                        </div>
                      </div>
                    </td>
                    {weekDates.map((d, i) => {
                      const dateStr = formatDate(d);
                      const shift = shiftMap[agent.id]?.[dateStr];
                      const isToday = dateStr === today;
                      const template = shift?.shift_template as ShiftTemplateRow | undefined;

                      return (
                        <td key={i} className={cn('text-center px-1 py-1.5', isToday && 'bg-primary/5')}>
                          <button
                            onClick={() => openEdit(agent.id, dateStr)}
                            className={cn(
                              'w-full rounded-md border px-2 py-1.5 text-[10px] transition-all hover:shadow-md cursor-pointer',
                              shift?.is_off_day
                                ? 'bg-muted/50 text-muted-foreground border-dashed'
                                : template
                                  ? shiftColors[template.type] || shiftColors.custom
                                  : 'border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50'
                            )}
                          >
                            {shift?.is_off_day ? (
                              <span className="font-medium">OFF</span>
                            ) : template ? (
                              <>
                                <div className="font-semibold">{template.name}</div>
                                <div className="opacity-75">{template.start_time}–{template.end_time}</div>
                              </>
                            ) : (
                              <span className="italic">+ Assign</span>
                            )}
                            {shift?.override_reason && (
                              <div className="text-[8px] text-warning mt-0.5">Override</div>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Shift Drawer */}
      <DetailDrawer open={editOpen} onClose={() => setEditOpen(false)} title="Edit Shift Assignment">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Agent</label>
            <p className="text-sm text-muted-foreground">{agents.find(a => a.id === editAgentId)?.full_name || '—'}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Date</label>
            <p className="text-sm text-muted-foreground">{editDate}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Shift</label>
            <select
              value={editShiftId}
              onChange={e => setEditShiftId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.start_time}–{t.end_time})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="off-day" checked={editIsOff} onChange={e => setEditIsOff(e.target.checked)} className="rounded" />
            <label htmlFor="off-day" className="text-sm font-medium">Mark as Off Day</label>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Override Reason (optional)</label>
            <textarea
              value={editReason}
              onChange={e => setEditReason(e.target.value)}
              placeholder="e.g. Schedule swap, personal request"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSaveShift} disabled={upsertShift.isPending}>
              <Save className="h-4 w-4 mr-2" /> {editExistingId ? 'Update' : 'Assign'} Shift
            </Button>
            {editExistingId && (
              <Button variant="destructive" size="icon" onClick={() => {
                deleteShift.mutate(editExistingId, { onSuccess: () => setEditOpen(false) });
              }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DetailDrawer>

      {/* Bulk Assign Drawer */}
      <DetailDrawer open={bulkOpen} onClose={() => setBulkOpen(false)} title="Assign Weekly Roster">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Assign the same shift for the entire displayed week, with one off day.</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Agents ({bulkAgentIds.length} selected)</label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setBulkAgentIds(agents.map(a => a.id))}>Select All</Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setBulkAgentIds([])}>Clear</Button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border bg-background p-2 space-y-1">
              {agents.map(a => (
                <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer text-sm">
                  <Checkbox
                    checked={bulkAgentIds.includes(a.id)}
                    onCheckedChange={(checked) => {
                      setBulkAgentIds(prev => checked ? [...prev, a.id] : prev.filter(id => id !== a.id));
                    }}
                  />
                  <span>{a.full_name}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{a.city}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Shift</label>
            <select value={bulkShiftId} onChange={e => setBulkShiftId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">Select shift...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.start_time}–{t.end_time})</option>)}
            </select>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-xs font-medium mb-1">Off-Day Distribution (auto, weekdays only)</p>
            <p className="text-[10px] text-muted-foreground mb-2">Off-days are evenly spread Mon–Fri. After every 5 agents, the cycle repeats.</p>
            {bulkAgentIds.length > 0 ? (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {bulkAgentIds.map(agentId => {
                  const agent = agents.find(a => a.id === agentId);
                  const offIdx = bulkOffDayMap[agentId];
                  return (
                    <div key={agentId} className="grid grid-cols-8 gap-1 text-[10px] items-center">
                      <div className="col-span-1 font-medium truncate" title={agent?.full_name}>{agent?.full_name?.split(' ')[0]}</div>
                      {DAY_LABELS.map((d, i) => (
                        <div key={i} className={cn(
                          'rounded px-0.5 py-1 border text-center',
                          offIdx === i ? 'bg-muted text-muted-foreground border-dashed font-bold' : 'bg-primary/5 text-primary'
                        )}>
                          {offIdx === i ? 'OFF' : d}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground text-center py-2">Select agents to see off-day preview</p>
            )}
          </div>
          <Button className="w-full" onClick={handleBulkAssign} disabled={bulkAgentIds.length === 0 || !bulkShiftId || bulkAssign.isPending}>
            Assign Weekly Roster to {bulkAgentIds.length} Agent{bulkAgentIds.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
