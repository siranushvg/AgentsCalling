/**
 * Call State Machine — Single source of truth for call status transitions.
 * 
 * Production-hardened: no invalid transitions, structured logging, strict types.
 */

// DB-aligned call statuses (matches public.call_status enum exactly)
export type CallStatus = 'ringing' | 'connected' | 'on_hold' | 'completed' | 'missed' | 'failed';

// Frontend-only transient states
export type CallState = 'idle' | 'initiating' | CallStatus | 'ended';

/**
 * Valid transitions map. Each key maps to the set of states it can transition TO.
 */
const VALID_TRANSITIONS: Record<CallState, readonly CallState[]> = {
  idle:       ['initiating'],
  initiating: ['ringing', 'failed', 'idle'],
  ringing:    ['connected', 'missed', 'failed', 'ended', 'completed'],
  connected:  ['on_hold', 'completed', 'ended', 'failed'],
  on_hold:    ['connected', 'completed', 'ended', 'failed'],
  completed:  ['ended', 'idle'],
  missed:     ['ended', 'idle'],
  failed:     ['idle'],
  ended:      ['idle'],
} as const;

/**
 * Validates and logs a call state transition.
 * Returns the new state if valid, or null if the transition is rejected.
 */
export function transitionCallState(
  current: CallState,
  next: CallState,
  context?: string,
): CallState | null {
  if (current === next) return current; // no-op

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    console.error(
      `[CallStateMachine] REJECTED transition: ${current} → ${next}`,
      context ? `(${context})` : '',
    );
    return null;
  }

  console.log(
    `[CallStateMachine] ${current} → ${next}`,
    context ? `(${context})` : '',
  );
  return next;
}

/**
 * Maps a frontend CallState to the DB call_status enum value for persistence.
 * Returns null for transient states that shouldn't be persisted.
 */
export function toDbCallStatus(state: CallState): CallStatus | null {
  switch (state) {
    case 'ringing':
    case 'connected':
    case 'on_hold':
    case 'completed':
    case 'missed':
    case 'failed':
      return state;
    case 'ended':
      return 'completed'; // ended = completed for DB purposes
    default:
      return null;
  }
}

/**
 * Determines the terminal DB status based on call duration.
 */
export function terminalStatus(durationSeconds: number): 'completed' | 'missed' {
  return durationSeconds > 0 ? 'completed' : 'missed';
}

/**
 * Type guard: is this state an "active" call state (agent is on a call)?
 */
export function isActiveCallState(state: CallState): boolean {
  return state === 'initiating' || state === 'ringing' || state === 'connected' || state === 'on_hold';
}

/**
 * Type guard: is this a terminal state?
 */
export function isTerminalState(state: CallState): boolean {
  return state === 'completed' || state === 'missed' || state === 'failed' || state === 'ended';
}
