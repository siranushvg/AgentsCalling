export type AppRole = 'agent' | 'team_lead' | 'admin';

export type AgentStatus = 'pending' | 'training' | 'active' | 'suspended' | 'terminated';
export type LeadStatus = 'new' | 'assigned' | 'contacted' | 'callback' | 'converted' | 'expired' | 'not_interested';
export type LeadTemperature = 'hot' | 'warm' | 'cool';
export type CallStatus = 'ringing' | 'connected' | 'on_hold' | 'completed' | 'missed' | 'failed';
export type DispositionType = 'interested' | 'callback' | 'not_interested' | 'no_answer' | 'wrong_number' | 'language_mismatch' | 'converted';
export type MessageChannel = 'whatsapp' | 'sms' | 'rcs';
export type ShiftType = 'morning' | 'afternoon' | 'evening' | 'custom';
export type MgEligibility = 'eligible' | 'at_risk' | 'not_eligible';
export type SalaryEligibility = 'eligible' | 'partial' | 'not_eligible';
export type FlagSeverity = 'low' | 'medium' | 'high';

export const LANGUAGES = ['Hindi', 'English', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Bengali', 'Kannada'] as const;
export type Language = typeof LANGUAGES[number];

export interface Agent {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  city: string;
  languages: Language[];
  referral_code: string;
  referred_by?: string;
  status: AgentStatus;
  role: AppRole;
  team_lead_id?: string;
  training_completed: boolean;
  training_progress: number; // 0-6
  created_at: string;
}

export interface Lead {
  id: string;
  username: string;
  state: string;
  language: Language;
  signup_minutes_ago: number;
  temperature: LeadTemperature;
  potential_commission: number;
  score: number;
  status: LeadStatus;
  assigned_agent_id?: string;
  source: 'ad_campaign' | 'organic' | 'direct';
  campaign_id?: string;
  created_at: string;
  import_date?: string;
  import_batch_id?: string;
  imported_by_admin?: string;
  serial_number?: number;
  total_call_attempts?: number;
  last_called_at?: string;
}

export interface Call {
  id: string;
  agent_id: string;
  lead_id: string;
  lead_username: string;
  status: CallStatus;
  duration_seconds: number;
  disposition?: DispositionType;
  notes?: string;
  started_at: string;
  ended_at?: string;
}

export interface Template {
  id: string;
  name: string;
  channel: MessageChannel;
  content: string;
  active: boolean;
}

export interface Message {
  id: string;
  agent_id: string;
  lead_id: string;
  channel: MessageChannel;
  template_id: string;
  content: string;
  delivery_status: 'sent' | 'delivered' | 'read' | 'failed';
  sent_at: string;
}

export interface CommissionSettings {
  id: string;
  direct_rate: number;
  tier2_rate: number;
  tier3_rate: number;
  effective_from: string;
  created_by: string;
}

export interface Commission {
  id: string;
  agent_id: string;
  lead_id: string;
  amount: number;
  rate_used: number;
  tier: 'direct' | 'tier2' | 'tier3';
  tier2_agent_id?: string;
  tier3_agent_id?: string;
  reassignment_split?: boolean;
  split_percentage?: number;
  created_at: string;
}

export interface MgPayment {
  id: string;
  agent_id: string;
  month: string;
  amount: number;
  eligibility: MgEligibility;
  active_hours: number;
  status: 'pending' | 'paid' | 'withheld' | 'suspended';
  reason?: string;
}

export interface SalaryTier {
  id: string;
  name: string;
  min_tenure_months: number;
  max_tenure_months: number | null;
  basic_salary: number;
}

export interface SalarySettings {
  id: string;
  min_hours_required: number;
  min_calls_required: number;
  call_bonus_amount: number;
  effective_from: string;
}

export interface SalaryPayment {
  id: string;
  agent_id: string;
  month: string;
  tier_name: string;
  basic_salary: number;
  hours_logged: number;
  hours_eligible: boolean;
  calls_made: number;
  calls_eligible: boolean;
  call_bonus: number;
  total_salary: number;
  status: 'pending' | 'paid' | 'withheld';
}

export interface Payout {
  id: string;
  agent_id: string;
  period_start: string;
  period_end: string;
  commission_earned: number;
  mg_paid: number;
  basic_salary_paid: number;
  call_bonus_paid: number;
  net_payout: number;
  status: 'pending' | 'processed' | 'paid';
  created_at: string;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  type: ShiftType;
  start_time: string; // HH:mm
  end_time: string;
}

export interface AgentShift {
  id: string;
  agent_id: string;
  shift_template_id: string;
  date: string;
  is_off_day: boolean;
  override_reason?: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string;
  actor_role: AppRole;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  created_at: string;
}

export interface LowActivityFlag {
  id: string;
  agent_id: string;
  agent_name: string;
  flag_type: string;
  severity: FlagSeverity;
  details: string;
  resolved: boolean;
  resolved_by?: string;
  created_at: string;
}

export interface NetworkMember {
  id: string;
  name: string;
  tier: 'tier2' | 'tier3';
  status: AgentStatus;
  ftds: number;
  earnings_generated: number;
  joined_at: string;
}

export interface QAScorecard {
  id: string;
  call_id: string;
  agent_id: string;
  reviewer_id: string;
  opening: number;
  script_adherence: number;
  objection_handling: number;
  closing: number;
  compliance: number;
  total: number;
  notes?: string;
  flagged_for_admin: boolean;
  created_at: string;
}
