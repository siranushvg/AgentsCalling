import { mockAgents, mockShiftTemplates } from '@/data/mockData';
import { Agent, ShiftTemplate } from '@/types';

export type ShiftAssignment = {
  agent: Agent;
  shiftTemplate: ShiftTemplate;
  isOffDay: boolean;
  isOverride: boolean;
  overrideReason?: string;
};

export type DaySchedule = {
  date: Date;
  assignments: ShiftAssignment[];
  totalActive: number;
  totalOff: number;
  morningCount: number;
  afternoonCount: number;
  eveningCount: number;
  customCount: number;
  hasOverrides: boolean;
  isUnderstaffed: boolean;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function getActiveAgents(): Agent[] {
  return mockAgents.filter(a => a.status === 'active');
}

export function generateDaySchedule(date: Date, weekOffset: number = 0): DaySchedule {
  const activeAgents = getActiveAgents();
  const shifts = mockShiftTemplates;
  const dow = date.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dow === 0 || dow === 6;
  const dayOfMonth = date.getDate();

  const assignments: ShiftAssignment[] = activeAgents.map((agent, idx) => {
    // Deterministic shift assignment based on agent index
    const shiftIdx = idx % shifts.length;
    const shift = shifts[shiftIdx];

    // Deterministic off-day: each agent gets one weekday off (never weekends)
    const offDayIdx = (idx + Math.floor(dayOfMonth / 7)) % 5; // 0=Mon, 4=Fri
    const agentOffDay = offDayIdx + 1; // 1=Mon, 5=Fri (JS getDay: 1=Mon, 5=Fri)
    const adjustedDow = dow === 0 ? 7 : dow; // Make Sunday = 7
    const isOffDay = !isWeekend && adjustedDow === agentOffDay;

    // Simulate some overrides
    const isOverride = dayOfMonth === 20 && idx === 0;

    return {
      agent,
      shiftTemplate: shift,
      isOffDay,
      isOverride,
      overrideReason: isOverride ? 'Schedule swap approved' : undefined,
    };
  });

  const working = assignments.filter(a => !a.isOffDay);
  const morningCount = working.filter(a => a.shiftTemplate.type === 'morning').length;
  const afternoonCount = working.filter(a => a.shiftTemplate.type === 'afternoon').length;
  const eveningCount = working.filter(a => a.shiftTemplate.type === 'evening').length;
  const customCount = working.filter(a => a.shiftTemplate.type === 'custom').length;

  return {
    date,
    assignments,
    totalActive: working.length,
    totalOff: assignments.filter(a => a.isOffDay).length,
    morningCount,
    afternoonCount,
    eveningCount,
    customCount,
    hasOverrides: assignments.some(a => a.isOverride),
    isUnderstaffed: working.length < activeAgents.length * 0.7,
  };
}

export function getMonthSchedules(year: number, month: number): DaySchedule[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const schedules: DaySchedule[] = [];

  // Pad start to Monday
  let startPad = (firstDay.getDay() + 6) % 7;
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    schedules.push(generateDaySchedule(d));
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    schedules.push(generateDaySchedule(new Date(year, month, d)));
  }

  // Pad end to Sunday
  while (schedules.length % 7 !== 0) {
    const last = schedules[schedules.length - 1].date;
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    schedules.push(generateDaySchedule(next));
  }

  return schedules;
}

export function getTodaySchedule(): DaySchedule {
  return generateDaySchedule(new Date());
}

export function getShiftAgents(shiftType: string, date: Date): ShiftAssignment[] {
  const schedule = generateDaySchedule(date);
  return schedule.assignments.filter(
    a => !a.isOffDay && a.shiftTemplate.type === shiftType
  );
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
