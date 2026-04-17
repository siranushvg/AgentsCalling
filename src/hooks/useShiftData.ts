import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ShiftTemplateRow {
  id: string;
  name: string;
  type: 'morning' | 'afternoon' | 'evening' | 'custom';
  start_time: string;
  end_time: string;
}

export interface AgentShiftRow {
  id: string;
  agent_id: string;
  shift_template_id: string;
  date: string;
  is_off_day: boolean;
  override_reason: string | null;
  created_at: string;
  shift_template?: ShiftTemplateRow;
  agent?: { id: string; full_name: string; email: string; city: string; languages: string[]; status: string };
}

// Fetch all shift templates
export function useShiftTemplates() {
  return useQuery({
    queryKey: ['shift-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_templates')
        .select('*')
        .order('type');
      if (error) throw error;
      return data as ShiftTemplateRow[];
    },
  });
}

// Fetch agent shifts for a date range (admin view)
export function useAgentShifts(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['agent-shifts', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_shifts')
        .select('*, shift_template:shift_templates(*), agent:agents(id, full_name, email, city, languages, status)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');
      if (error) throw error;
      return (data || []) as unknown as AgentShiftRow[];
    },
    enabled: !!startDate && !!endDate,
  });
}

// Fetch shifts for a specific agent (agent view)
export function useMyShifts(startDate?: string, endDate?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-shifts', user?.id, startDate, endDate],
    queryFn: async () => {
      // First get agent_id
      const { data: agentData } = await supabase
        .rpc('get_agent_id_for_user', { _user_id: user!.id });
      if (!agentData) return [];

      let query = supabase
        .from('agent_shifts')
        .select('*, shift_template:shift_templates(*)')
        .eq('agent_id', agentData)
        .order('date');
      
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AgentShiftRow[];
    },
    enabled: !!user?.id,
  });
}

// Fetch all active agents for admin shift assignment
export function useActiveAgents() {
  return useQuery({
    queryKey: ['active-agents-for-shifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('id, full_name, email, city, languages, status')
        .in('status', ['active', 'training'])
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
  });
}

// Upsert a single agent shift
export function useUpsertShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      agent_id: string;
      shift_template_id: string;
      date: string;
      is_off_day: boolean;
      override_reason?: string;
      existingId?: string;
    }) => {
      if (params.existingId) {
        const { error } = await supabase
          .from('agent_shifts')
          .update({
            shift_template_id: params.shift_template_id,
            is_off_day: params.is_off_day,
            override_reason: params.override_reason || null,
          })
          .eq('id', params.existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agent_shifts')
          .insert({
            agent_id: params.agent_id,
            shift_template_id: params.shift_template_id,
            date: params.date,
            is_off_day: params.is_off_day,
            override_reason: params.override_reason || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-shifts'] });
      qc.invalidateQueries({ queryKey: ['my-shifts'] });
      toast.success('Shift updated successfully');
    },
    onError: (err: any) => {
      toast.error('Failed to update shift: ' + err.message);
    },
  });
}

// Bulk assign shifts for a week
export function useBulkAssignShifts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shifts: Array<{
      agent_id: string;
      shift_template_id: string;
      date: string;
      is_off_day: boolean;
      override_reason?: string;
    }>) => {
      // Delete existing shifts for these agent+date combos first
      for (const shift of shifts) {
        await supabase
          .from('agent_shifts')
          .delete()
          .eq('agent_id', shift.agent_id)
          .eq('date', shift.date);
      }
      const { error } = await supabase
        .from('agent_shifts')
        .insert(shifts.map(s => ({
          agent_id: s.agent_id,
          shift_template_id: s.shift_template_id,
          date: s.date,
          is_off_day: s.is_off_day,
          override_reason: s.override_reason || null,
        })));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-shifts'] });
      qc.invalidateQueries({ queryKey: ['my-shifts'] });
      toast.success('Shifts assigned successfully');
    },
    onError: (err: any) => {
      toast.error('Failed to assign shifts: ' + err.message);
    },
  });
}

// Delete a shift
export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase
        .from('agent_shifts')
        .delete()
        .eq('id', shiftId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-shifts'] });
      qc.invalidateQueries({ queryKey: ['my-shifts'] });
      toast.success('Shift removed');
    },
  });
}

// Helper: format date to YYYY-MM-DD
export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in IST
}

// Helper: get week dates (Mon-Sun)
export function getWeekDates(weekOffset: number = 0): Date[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export { DAY_LABELS };
