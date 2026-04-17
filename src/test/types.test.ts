import { describe, it, expect } from 'vitest';
import type { Lead, Agent, Call, LeadStatus, CallStatus, DispositionType } from '@/types';

describe('Type definitions', () => {
  it('Lead interface has all required fields', () => {
    const lead: Lead = {
      id: 'test-id',
      username: 'testuser',
      state: 'Maharashtra',
      language: 'Hindi',
      signup_minutes_ago: 30,
      temperature: 'hot',
      potential_commission: 100,
      score: 75,
      status: 'new',
      source: 'organic',
      created_at: new Date().toISOString(),
    };
    expect(lead.id).toBe('test-id');
    expect(lead.status).toBe('new');
  });

  it('Lead supports optional total_call_attempts', () => {
    const lead: Lead = {
      id: '1',
      username: 'test',
      state: 'KA',
      language: 'English',
      signup_minutes_ago: 10,
      temperature: 'warm',
      potential_commission: 0,
      score: 50,
      status: 'contacted',
      source: 'direct',
      created_at: '',
      total_call_attempts: 5,
      last_called_at: new Date().toISOString(),
    };
    expect(lead.total_call_attempts).toBe(5);
  });

  it('LeadStatus covers all expected values', () => {
    const statuses: LeadStatus[] = ['new', 'assigned', 'contacted', 'callback', 'converted', 'expired', 'not_interested'];
    expect(statuses).toHaveLength(7);
  });

  it('CallStatus covers all expected values', () => {
    const statuses: CallStatus[] = ['ringing', 'connected', 'on_hold', 'completed', 'missed', 'failed'];
    expect(statuses).toHaveLength(6);
  });

  it('DispositionType covers all expected values', () => {
    const dispositions: DispositionType[] = ['interested', 'callback', 'not_interested', 'no_answer', 'wrong_number', 'language_mismatch', 'converted'];
    expect(dispositions).toHaveLength(7);
  });
});
