import { Agent, Lead, Call, Template, Message, CommissionSettings, Commission, MgPayment, Payout, ShiftTemplate, ActivityLog, LowActivityFlag, NetworkMember, QAScorecard, AppRole, SalaryTier, SalarySettings, SalaryPayment } from '@/types';

// ========== AGENTS (removed — all agent data now comes from the database) ==========
export const mockAgents: Agent[] = [];
export const mockTeamLeads: Agent[] = [];
export const mockAdmins: Agent[] = [];

// ========== LEADS ==========
const states = ['Maharashtra', 'Gujarat', 'Tamil Nadu', 'Karnataka', 'West Bengal', 'Telangana', 'Rajasthan', 'Uttar Pradesh'];
const leadNames = ['Aarav_M', 'Diya_R', 'Rohan_K', 'Meera_S', 'Arjun_P', 'Neha_V', 'Karan_B', 'Sneha_G', 'Ishaan_D', 'Riya_C', 'Aditya_N', 'Pooja_L', 'Vivek_T', 'Anita_H', 'Raj_W', 'Simran_J', 'Dhruv_A', 'Kavya_F', 'Nikhil_E', 'Tanya_I', 'Manish_O', 'Sakshi_U', 'Varun_Q', 'Divya_X', 'Sanjay_Z'];

export const mockLeads: Lead[] = Array.from({ length: 25 }, (_, i) => ({
  id: `l${i + 1}`,
  username: leadNames[i],
  state: states[i % states.length],
  language: (['Hindi', 'English', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Bengali', 'Kannada'] as const)[i % 8],
  signup_minutes_ago: Math.floor(Math.random() * 2800) + 5,
  temperature: (['hot', 'warm', 'cool'] as const)[i % 3],
  potential_commission: [500, 750, 1000, 1250, 1500][i % 5],
  score: Math.floor(Math.random() * 40) + 60,
  status: (['new', 'assigned', 'contacted', 'callback'] as const)[i % 4],
  assigned_agent_id: i < 12 ? `a${(i % 8) + 1}` : undefined,
  source: 'ad_campaign' as const,
  campaign_id: `camp_${(i % 3) + 1}`,
  created_at: '2026-03-17',
}));

// ========== CALLS ==========
export const mockCalls: Call[] = [
  { id: 'c1', agent_id: 'a1', lead_id: 'l1', lead_username: 'Aarav_M', status: 'connected', duration_seconds: 245, started_at: '2026-03-17T10:30:00', notes: 'Interested in premium features. Wants WhatsApp follow-up with details.' },
  { id: 'c2', agent_id: 'a2', lead_id: 'l3', lead_username: 'Rohan_K', status: 'completed', duration_seconds: 180, disposition: 'callback', started_at: '2026-03-17T09:15:00', ended_at: '2026-03-17T09:18:00', notes: 'Callback scheduled for 3pm today. Prefers to discuss after work.' },
  { id: 'c3', agent_id: 'a3', lead_id: 'l5', lead_username: 'Arjun_P', status: 'completed', duration_seconds: 420, disposition: 'converted', started_at: '2026-03-17T11:00:00', ended_at: '2026-03-17T11:07:00', notes: 'Converted on first call. Made ₹10,000 FTD.' },
  { id: 'c4', agent_id: 'a4', lead_id: 'l8', lead_username: 'Sneha_G', status: 'ringing', duration_seconds: 0, started_at: '2026-03-17T12:45:00' },
  { id: 'c5', agent_id: 'a6', lead_id: 'l10', lead_username: 'Riya_C', status: 'connected', duration_seconds: 92, started_at: '2026-03-17T12:30:00', notes: 'Currently discussing account setup options.' },
];

// ========== AGENT ACTIVE TIME (avg active minutes per day, based on call activity) ==========
export const mockAgentActiveTime: Record<string, { avgMinutesPerDay: number; todayMinutes: number; weekMinutes: number; activeDays: number }> = {
  'a1': { avgMinutesPerDay: 320, todayMinutes: 285, weekMinutes: 1540, activeDays: 22 },
  'a2': { avgMinutesPerDay: 225, todayMinutes: 190, weekMinutes: 1080, activeDays: 20 },
  'a3': { avgMinutesPerDay: 365, todayMinutes: 340, weekMinutes: 1820, activeDays: 23 },
  'a4': { avgMinutesPerDay: 280, todayMinutes: 120, weekMinutes: 1260, activeDays: 18 },
  'a5': { avgMinutesPerDay: 0, todayMinutes: 0, weekMinutes: 0, activeDays: 0 },
  'a6': { avgMinutesPerDay: 195, todayMinutes: 165, weekMinutes: 920, activeDays: 15 },
  'a7': { avgMinutesPerDay: 310, todayMinutes: 0, weekMinutes: 0, activeDays: 19 },
  'a8': { avgMinutesPerDay: 245, todayMinutes: 210, weekMinutes: 1180, activeDays: 17 },
  'tl1': { avgMinutesPerDay: 180, todayMinutes: 95, weekMinutes: 840, activeDays: 21 },
  'tl2': { avgMinutesPerDay: 155, todayMinutes: 80, weekMinutes: 720, activeDays: 19 },
};

// ========== TEMPLATES ==========
export const mockTemplates: Template[] = [
  { id: 't1', name: 'First Contact – Welcome', channel: 'whatsapp', content: 'Hi {{name}}, this is {{agent}} from Arena365. Welcome aboard! 🎉 Your account is set up and ready to go. If you have any questions about getting started, just reply here — I\'m happy to help.', active: true },
  { id: 't2', name: 'Follow-Up – After Call', channel: 'whatsapp', content: 'Hi {{name}}, thanks for speaking with me earlier. As discussed, here are the next steps to get started with Arena365. Let me know if you need anything else — I\'m here to help.', active: true },
  { id: 't3', name: 'Callback Reminder', channel: 'sms', content: 'Hi {{name}}, this is a reminder about our scheduled call today. I\'ll be reaching out shortly. Looking forward to connecting — Arena365 Team.', active: true },
  { id: 't4', name: 'Interested Lead – Next Steps', channel: 'whatsapp', content: 'Hi {{name}}, you mentioned you\'d like to explore Arena365 further. Here\'s a quick overview of what\'s available in your account. Ready when you are!', active: true },
  { id: 't5', name: 'No-Answer Follow-Up', channel: 'sms', content: 'Hi {{name}}, I tried reaching you earlier but couldn\'t connect. No worries — feel free to reply with a good time to call, and I\'ll reach out then. — Arena365', active: true },
  { id: 't6', name: 'RCS Welcome Card', channel: 'rcs', content: 'Welcome to Arena365! 🚀 Your account is active and ready. Tap below to explore your dashboard and get started with your first session.', active: true },
  { id: 't7', name: 'First Contact – SMS', channel: 'sms', content: 'Hi {{name}}, welcome to Arena365! Your account is ready. We\'ll call you shortly to walk you through getting started. — Arena365 Team', active: true },
  { id: 't8', name: 'RCS Follow-Up', channel: 'rcs', content: 'Hi {{name}}, thanks for your interest in Arena365. Here\'s a quick summary of what we discussed. Tap the button below to continue where we left off.', active: true },
  { id: 't9', name: 'Inactive Promo (Archived)', channel: 'sms', content: 'Limited time offer — sign up today and get bonus features.', active: false },
];

// ========== MESSAGES ==========
export const mockMessages: Message[] = [
  { id: 'm1', agent_id: 'a1', lead_id: 'l1', channel: 'whatsapp', template_id: 't1', content: 'Hi Aarav, this is Rahul from Arena365. Welcome aboard! 🎉 Your account is set up and ready to go.', delivery_status: 'read', sent_at: '2026-03-17T10:00:00' },
  { id: 'm2', agent_id: 'a1', lead_id: 'l1', channel: 'whatsapp', template_id: 't2', content: 'Hi Aarav, thanks for speaking with me earlier. Here are the next steps to get started with Arena365.', delivery_status: 'delivered', sent_at: '2026-03-17T12:00:00' },
  { id: 'm3', agent_id: 'a2', lead_id: 'l3', channel: 'sms', template_id: 't3', content: 'Hi Rohan, this is a reminder about our scheduled call today. Looking forward to connecting — Arena365 Team.', delivery_status: 'sent', sent_at: '2026-03-17T11:30:00' },
  { id: 'm4', agent_id: 'a3', lead_id: 'l5', channel: 'whatsapp', template_id: 't4', content: 'Hi Arjun, you mentioned you\'d like to explore Arena365 further. Here\'s a quick overview of what\'s available.', delivery_status: 'delivered', sent_at: '2026-03-17T11:10:00' },
  { id: 'm5', agent_id: 'a1', lead_id: 'l2', channel: 'sms', template_id: 't5', content: 'Hi Diya, I tried reaching you earlier but couldn\'t connect. Reply with a good time to call — Arena365.', delivery_status: 'sent', sent_at: '2026-03-17T10:45:00' },
];

// ========== COMMISSION SETTINGS ==========
export const mockCommissionSettings: CommissionSettings[] = [
  { id: 'cs1', direct_rate: 25, tier2_rate: 5, tier3_rate: 3, effective_from: '2026-01-01', created_by: 'admin1' },
  { id: 'cs2', direct_rate: 30, tier2_rate: 5, tier3_rate: 3, effective_from: '2026-03-01', created_by: 'admin1' },
];

export const currentCommissionRates = mockCommissionSettings[mockCommissionSettings.length - 1];

// ========== COMMISSIONS ==========
export const mockCommissions: Commission[] = [
  { id: 'com1', agent_id: 'a1', lead_id: 'l5', amount: 3000, rate_used: 30, tier: 'direct', created_at: '2026-03-15' },
  { id: 'com2', agent_id: 'a1', lead_id: 'l12', amount: 2250, rate_used: 30, tier: 'direct', reassignment_split: true, split_percentage: 75, created_at: '2026-03-10' },
  { id: 'com3', agent_id: 'a2', lead_id: 'l8', amount: 3000, rate_used: 30, tier: 'direct', created_at: '2026-03-12' },
  { id: 'com4', agent_id: 'a1', lead_id: 'l20', amount: 500, rate_used: 5, tier: 'tier2', tier2_agent_id: 'a2', created_at: '2026-03-12' },
  { id: 'com5', agent_id: 'a1', lead_id: 'l21', amount: 300, rate_used: 3, tier: 'tier3', tier3_agent_id: 'a4', created_at: '2026-03-14' },
  { id: 'com6', agent_id: 'a3', lead_id: 'l15', amount: 3000, rate_used: 30, tier: 'direct', created_at: '2026-03-16' },
];

// ========== MG PAYMENTS (legacy — kept for backward compat) ==========
export const mockMgPayments: MgPayment[] = [
  { id: 'mg1', agent_id: 'a1', month: '2026-03', amount: 25000, eligibility: 'eligible', active_hours: 52, status: 'paid' },
  { id: 'mg2', agent_id: 'a2', month: '2026-03', amount: 25000, eligibility: 'at_risk', active_hours: 44, status: 'pending' },
  { id: 'mg3', agent_id: 'a3', month: '2026-03', amount: 25000, eligibility: 'eligible', active_hours: 49, status: 'paid' },
  { id: 'mg4', agent_id: 'a4', month: '2026-03', amount: 25000, eligibility: 'not_eligible', active_hours: 36, status: 'withheld' },
  { id: 'mg5', agent_id: 'a7', month: '2026-03', amount: 25000, eligibility: 'not_eligible', active_hours: 0, status: 'suspended', reason: 'Agent suspended — repeated low activity flags over 3 consecutive weeks' },
];

// ========== SALARY TIERS ==========
export const mockSalaryTiers: SalaryTier[] = [
  { id: 'st-jr', name: 'Junior', min_tenure_months: 0, max_tenure_months: 3, basic_salary: 15000 },
  { id: 'st-mid', name: 'Mid-Level', min_tenure_months: 3, max_tenure_months: 6, basic_salary: 20000 },
  { id: 'st-sr', name: 'Senior', min_tenure_months: 6, max_tenure_months: null, basic_salary: 25000 },
];

// ========== SALARY SETTINGS ==========
export const mockSalarySettings: SalarySettings = {
  id: 'ss1',
  min_hours_required: 208,
  min_calls_required: 1050,
  call_bonus_amount: 5000,
  effective_from: '2026-01-01',
};

// ========== SALARY PAYMENTS ==========
export const mockSalaryPayments: SalaryPayment[] = [
  { id: 'sp1', agent_id: 'a1', month: '2026-03', tier_name: 'Mid-Level', basic_salary: 20000, hours_logged: 172, hours_eligible: true, calls_made: 620, calls_eligible: true, call_bonus: 5000, total_salary: 25000, status: 'paid' },
  { id: 'sp2', agent_id: 'a2', month: '2026-03', tier_name: 'Junior', basic_salary: 15000, hours_logged: 148, hours_eligible: false, calls_made: 520, calls_eligible: true, call_bonus: 5000, total_salary: 5000, status: 'pending' },
  { id: 'sp3', agent_id: 'a3', month: '2026-03', tier_name: 'Junior', basic_salary: 15000, hours_logged: 165, hours_eligible: true, calls_made: 480, calls_eligible: false, call_bonus: 0, total_salary: 15000, status: 'paid' },
  { id: 'sp4', agent_id: 'a4', month: '2026-03', tier_name: 'Junior', basic_salary: 15000, hours_logged: 120, hours_eligible: false, calls_made: 310, calls_eligible: false, call_bonus: 0, total_salary: 0, status: 'withheld' },
  { id: 'sp5', agent_id: 'a8', month: '2026-03', tier_name: 'Junior', basic_salary: 15000, hours_logged: 155, hours_eligible: false, calls_made: 540, calls_eligible: true, call_bonus: 5000, total_salary: 5000, status: 'pending' },
];

// ========== PAYOUTS ==========
export const mockPayouts: Payout[] = [
  { id: 'p1', agent_id: 'a1', period_start: '2026-03-01', period_end: '2026-03-31', commission_earned: 6825, mg_paid: 0, basic_salary_paid: 20000, call_bonus_paid: 5000, net_payout: 31825, status: 'processed', created_at: '2026-03-31' },
  { id: 'p2', agent_id: 'a1', period_start: '2026-02-01', period_end: '2026-02-28', commission_earned: 15000, mg_paid: 0, basic_salary_paid: 20000, call_bonus_paid: 5000, net_payout: 40000, status: 'paid', created_at: '2026-03-01' },
  { id: 'p3', agent_id: 'a2', period_start: '2026-03-01', period_end: '2026-03-31', commission_earned: 3500, mg_paid: 0, basic_salary_paid: 0, call_bonus_paid: 5000, net_payout: 8500, status: 'pending', created_at: '2026-03-31' },
];

// ========== SHIFT TEMPLATES ==========
export const mockShiftTemplates: ShiftTemplate[] = [
  { id: 'st1', name: 'Morning', type: 'morning', start_time: '09:00', end_time: '17:00' },
  { id: 'st2', name: 'Afternoon', type: 'afternoon', start_time: '11:00', end_time: '19:00' },
  { id: 'st3', name: 'Evening', type: 'evening', start_time: '13:00', end_time: '21:00' },
];

// ========== LOW ACTIVITY FLAGS ==========
export const mockLowActivityFlags: LowActivityFlag[] = [
  { id: 'laf1', agent_id: 'a4', agent_name: 'Ananya Das', flag_type: 'Low call attempts', severity: 'medium', details: 'Fewer than 5 call attempts in the 10:00–12:00 shift block. Expected minimum: 15 attempts per 2-hour window.', resolved: false, created_at: '2026-03-17T12:00:00' },
  { id: 'laf2', agent_id: 'a7', agent_name: 'Amit Joshi', flag_type: 'Contact rate below 20%', severity: 'high', details: 'Contact rate has been below 20% for 3 consecutive working days. This may indicate call quality or timing issues.', resolved: false, created_at: '2026-03-16T18:00:00' },
  { id: 'laf3', agent_id: 'a2', agent_name: 'Priya Patel', flag_type: 'Idle 30+ minutes', severity: 'low', details: 'No call attempts for 35 minutes during active shift window (11:15–11:50). Agent was logged in but idle.', resolved: true, resolved_by: 'tl1', created_at: '2026-03-17T11:00:00' },
];

// ========== NETWORK ==========
export const mockNetwork: NetworkMember[] = [
  { id: 'a2', name: 'Priya Patel', tier: 'tier2', status: 'active', ftds: 12, earnings_generated: 600, joined_at: '2025-12-15' },
  { id: 'a4', name: 'Ananya Das', tier: 'tier2', status: 'active', ftds: 8, earnings_generated: 400, joined_at: '2026-01-10' },
  { id: 'a6', name: 'Deepika Nair', tier: 'tier3', status: 'active', ftds: 5, earnings_generated: 100, joined_at: '2026-01-20' },
  { id: 'a8', name: 'Kavitha Murthy', tier: 'tier3', status: 'active', ftds: 3, earnings_generated: 60, joined_at: '2026-02-01' },
];

// ========== ACTIVITY LOG ==========
export const mockActivityLog: ActivityLog[] = [
  { id: 'al1', actor_id: 'a1', actor_role: 'agent', action: 'call_initiated', target_type: 'lead', target_id: 'l1', details: 'Called Aarav_M — connected for 4:05', created_at: '2026-03-17T10:30:00' },
  { id: 'al2', actor_id: 'admin1', actor_role: 'admin', action: 'commission_rate_updated', target_type: 'commission_settings', target_id: 'cs2', details: 'Direct rate changed from 30% → 35%, effective March 1', created_at: '2026-03-01T00:00:00' },
  { id: 'al3', actor_id: 'tl1', actor_role: 'team_lead', action: 'lead_reassigned', target_type: 'lead', target_id: 'l8', details: 'Reassigned Sneha_G from Priya Patel to Suresh Kumar (language mismatch)', created_at: '2026-03-17T11:15:00' },
  { id: 'al4', actor_id: 'admin1', actor_role: 'admin', action: 'agent_suspended', target_type: 'agent', target_id: 'a7', details: 'Amit Joshi suspended — repeated low activity flags over 3 consecutive weeks', created_at: '2026-03-15T16:00:00' },
  { id: 'al5', actor_id: 'a3', actor_role: 'agent', action: 'message_sent', target_type: 'lead', target_id: 'l5', details: 'WhatsApp: First Contact – Welcome template sent to Arjun_P', created_at: '2026-03-17T11:05:00' },
];

// ========== QA SCORECARDS ==========
export const mockQAScorecards: QAScorecard[] = [
  { id: 'qa1', call_id: 'c2', agent_id: 'a2', reviewer_id: 'tl1', opening: 8, script_adherence: 7, objection_handling: 6, closing: 8, compliance: 9, total: 38, notes: 'Good opening and compliance. Needs improvement on objection handling — missed opportunity to address "I need to think about it" with a softer redirect.', flagged_for_admin: false, created_at: '2026-03-17T10:00:00' },
  { id: 'qa2', call_id: 'c3', agent_id: 'a3', reviewer_id: 'tl1', opening: 9, script_adherence: 9, objection_handling: 8, closing: 9, compliance: 10, total: 45, notes: 'Excellent call. Professional opening, smooth transition to value proposition, handled callback request well. Converted on first attempt.', flagged_for_admin: false, created_at: '2026-03-17T12:00:00' },
];

// ========== DEMO USER SESSION (deprecated — use AuthContext + DB) ==========
export type DemoRole = AppRole;

export const getDemoUser = (role: DemoRole): Agent => {
  // Returns empty placeholder — real user data comes from AuthContext
  return { id: '', full_name: '', phone: '', email: '', city: '', languages: [], referral_code: '', status: 'active', role, training_completed: true, training_progress: 6, created_at: '' };
};

export const getTeamAgents = (_teamLeadId: string): Agent[] => [];


// ========== KPI HELPERS ==========
export const todayKPIs = {
  totalDials: 287,
  totalContacts: 142,
  totalFTDs: 18,
  conversionRate: 12.7,
  activeAgents: 6,
  totalAgents: 8,
  queueHealth: 85,
  avgCallDuration: '3:24',
  totalCommission: 63000,
  activeCalls: 2,
};

export const agentKPIs = {
  dialsToday: 42,
  contactsToday: 22,
  ftdsToday: 3,
  conversionRate: 14.3,
  commissionToday: 10500,
  commissionThisPeriod: 28750,
  activeHoursToday: 5.2,
  activeHoursThisWeek: 38.5,
  activeHoursThisMonth: 148,
  callsThisWeek: 720,
  callsRemaining: 8,
  shiftStart: '09:00',
  shiftEnd: '17:00',
  isWorkingDay: true,
  loggedInSince: '08:55',
  nextOffDay: 'Wednesday',
  mgEligibility: 'at_risk' as const,
  hoursTarget: 208,
  weeklyCallsTarget: 1050,
};
