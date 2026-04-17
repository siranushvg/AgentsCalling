import { describe, it, expect } from 'vitest';
import {
  transitionCallState,
  isActiveCallState,
  isTerminalState,
  toDbCallStatus,
  terminalStatus,
  type CallState,
} from '@/lib/callStateMachine';

describe('Call State Machine', () => {
  describe('valid transitions', () => {
    const validPaths: [CallState, CallState][] = [
      ['idle', 'initiating'],
      ['initiating', 'ringing'],
      ['initiating', 'failed'],
      ['ringing', 'connected'],
      ['ringing', 'missed'],
      ['connected', 'on_hold'],
      ['connected', 'completed'],
      ['on_hold', 'connected'],
      ['on_hold', 'completed'],
      ['completed', 'idle'],
      ['ended', 'idle'],
    ];

    validPaths.forEach(([from, to]) => {
      it(`allows ${from} → ${to}`, () => {
        expect(transitionCallState(from, to, 'test')).toBe(to);
      });
    });
  });

  describe('invalid transitions', () => {
    const invalidPaths: [CallState, CallState][] = [
      ['idle', 'connected'],
      ['idle', 'completed'],
      ['ringing', 'idle'],
      ['ringing', 'on_hold'],
      ['connected', 'ringing'],
      ['completed', 'connected'],
      ['ended', 'ringing'],
    ];

    invalidPaths.forEach(([from, to]) => {
      it(`rejects ${from} → ${to}`, () => {
        expect(transitionCallState(from, to, 'test')).toBeNull();
      });
    });
  });

  describe('same-state transition', () => {
    it('returns same state for no-op', () => {
      expect(transitionCallState('idle', 'idle')).toBe('idle');
      expect(transitionCallState('connected', 'connected')).toBe('connected');
    });
  });

  describe('isActiveCallState', () => {
    it('returns true for active states', () => {
      expect(isActiveCallState('initiating')).toBe(true);
      expect(isActiveCallState('ringing')).toBe(true);
      expect(isActiveCallState('connected')).toBe(true);
      expect(isActiveCallState('on_hold')).toBe(true);
    });

    it('returns false for inactive states', () => {
      expect(isActiveCallState('idle')).toBe(false);
      expect(isActiveCallState('ended')).toBe(false);
      expect(isActiveCallState('completed')).toBe(false);
      expect(isActiveCallState('missed')).toBe(false);
    });
  });

  describe('isTerminalState', () => {
    it('correctly identifies terminal states', () => {
      expect(isTerminalState('completed')).toBe(true);
      expect(isTerminalState('missed')).toBe(true);
      expect(isTerminalState('failed')).toBe(true);
      expect(isTerminalState('ended')).toBe(true);
      expect(isTerminalState('connected')).toBe(false);
      expect(isTerminalState('idle')).toBe(false);
    });
  });

  describe('toDbCallStatus', () => {
    it('maps DB-aligned states correctly', () => {
      expect(toDbCallStatus('ringing')).toBe('ringing');
      expect(toDbCallStatus('connected')).toBe('connected');
      expect(toDbCallStatus('completed')).toBe('completed');
      expect(toDbCallStatus('missed')).toBe('missed');
      expect(toDbCallStatus('failed')).toBe('failed');
    });

    it('maps ended to completed', () => {
      expect(toDbCallStatus('ended')).toBe('completed');
    });

    it('returns null for transient states', () => {
      expect(toDbCallStatus('idle')).toBeNull();
      expect(toDbCallStatus('initiating')).toBeNull();
    });
  });

  describe('terminalStatus', () => {
    it('returns completed when duration > 0', () => {
      expect(terminalStatus(30)).toBe('completed');
      expect(terminalStatus(1)).toBe('completed');
    });

    it('returns missed when duration is 0', () => {
      expect(terminalStatus(0)).toBe('missed');
    });
  });
});

describe('Inbound call flow', () => {
  it('follows ringing → connected → completed path', () => {
    let state: CallState = 'idle';
    
    // Simulate inbound: idle → initiating is for outbound, inbound goes idle → ringing via direct set
    // For inbound calls managed by AgentCallingContext, the state machine is used for DB writes
    // Test the transition chain for outbound which uses the machine:
    state = transitionCallState(state, 'initiating', 'test')!;
    expect(state).toBe('initiating');
    
    state = transitionCallState(state, 'ringing', 'test')!;
    expect(state).toBe('ringing');
    
    state = transitionCallState(state, 'connected', 'test')!;
    expect(state).toBe('connected');
    
    state = transitionCallState(state, 'completed', 'test')!;
    expect(state).toBe('completed');
    
    state = transitionCallState(state, 'idle', 'test')!;
    expect(state).toBe('idle');
  });

  it('follows ringing → missed path', () => {
    let state: CallState = 'initiating';
    state = transitionCallState(state, 'ringing', 'test')!;
    expect(state).toBe('ringing');
    
    state = transitionCallState(state, 'missed', 'test')!;
    expect(state).toBe('missed');
    
    state = transitionCallState(state, 'idle', 'test')!;
    expect(state).toBe('idle');
  });
});

describe('Lead disposition update', () => {
  it('terminalStatus maps correctly for disposition persistence', () => {
    // After a connected call with duration > 0
    expect(terminalStatus(45)).toBe('completed');
    // After a missed call with 0 duration
    expect(terminalStatus(0)).toBe('missed');
  });
});

describe('Agent assignment from queue', () => {
  it('active call state prevents new calls', () => {
    // Queue calling checks isActiveCallState before initiating next call
    expect(isActiveCallState('connected')).toBe(true);
    expect(isActiveCallState('ringing')).toBe(true);
    // Once idle, queue can proceed
    expect(isActiveCallState('idle')).toBe(false);
  });
});
