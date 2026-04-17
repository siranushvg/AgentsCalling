const STRONG_TERMINAL_EVENT_HINTS = [
  'hangup',
  'hang up',
  'call_ended',
  'call_completed',
  'no live call',
  'no_live_call',
  'no active call',
  'no_active_call',
  'no current call',
  'call ended',
  'call disconnected',
  'call not found',
  'not in call',
];

const WEAK_TERMINAL_EVENT_HINTS = [
  'ended',
  'completed',
  'disconnected',
  'wrapup',
  'terminated',
];

const parseNumberish = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const visitVoicelayValue = (
  value: unknown,
  visitor: (candidate: unknown, key?: string) => boolean | void,
  seen = new WeakSet<object>(),
  key?: string,
): boolean => {
  const shouldStop = visitor(value, key);
  if (shouldStop) return true;

  if (!value || typeof value !== 'object') return false;
  if (seen.has(value as object)) return false;

  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.some((item) => visitVoicelayValue(item, visitor, seen));
  }

  return Object.entries(value as Record<string, unknown>).some(([nestedKey, nestedValue]) =>
    visitVoicelayValue(nestedValue, visitor, seen, nestedKey)
  );
};

const collectVoicelayStrings = (value: unknown) => {
  const strings: string[] = [];

  visitVoicelayValue(value, (candidate) => {
    if (typeof candidate === 'string') {
      strings.push(candidate);
    }
  });

  return strings;
};

const extractVoicelayDuration = (value: unknown): number | null => {
  let duration: number | null = null;

  visitVoicelayValue(value, (candidate, key) => {
    if (!key) return false;

    const normalizedKey = key.toLowerCase();
    const looksLikeDurationKey =
      normalizedKey === 'duration' ||
      normalizedKey.endsWith('_duration') ||
      normalizedKey.endsWith('duration');

    if (!looksLikeDurationKey) return false;

    const parsed = parseNumberish(candidate);
    if (parsed === null) return false;

    duration = parsed;
    return true;
  });

  return duration;
};

const TRANSPORT_HINTS = [
  'transport',
  'websocket',
  'ws_reconnect',
  'socket',
  'connection_lost',
  'reconnecting',
  'switching views',
];

const INCOMING_CALL_HINTS = [
  'incoming',
  'inbound',
  'ringing_in',
  'incoming_call',
  'inbound_call',
  'ring',
  'ringing',
];

const extractCallerNumber = (value: unknown): string | null => {
  let callerNumber: string | null = null;

  visitVoicelayValue(value, (candidate, key) => {
    if (!key) return false;
    const k = key.toLowerCase();
    const isCallerKey =
      k === 'caller' ||
      k === 'caller_number' ||
      k === 'callernumber' ||
      k === 'from' ||
      k === 'from_number' ||
      k === 'fromnumber' ||
      k === 'calling_number' ||
      k === 'callingnumber' ||
      k === 'customer_number' ||
      k === 'customernumber' ||
      k === 'ani' ||
      k === 'cli';

    if (!isCallerKey || typeof candidate !== 'string') return false;

    const digits = candidate.replace(/[^0-9+]/g, '');
    if (digits.length >= 10) {
      callerNumber = digits;
      return true;
    }
    return false;
  });

  return callerNumber;
};

const extractSessionId = (value: unknown): string | null => {
  let sessionId: string | null = null;

  visitVoicelayValue(value, (candidate, key) => {
    if (!key) return false;
    const k = key.toLowerCase();
    const isSessionKey =
      k === 'session_id' ||
      k === 'sessionid' ||
      k === 'call_id' ||
      k === 'callid' ||
      k === 'unique_id' ||
      k === 'uniqueid' ||
      k === 'uuid';

    if (!isSessionKey) return false;
    if (typeof candidate === 'string' && candidate.length > 0) {
      sessionId = candidate;
      return true;
    }
    if (typeof candidate === 'number') {
      sessionId = String(candidate);
      return true;
    }
    return false;
  });

  return sessionId;
};

export const parseVoicelayMessage = (rawData: unknown) => {
  let payload = rawData;

  if (typeof rawData === 'string') {
    try {
      payload = JSON.parse(rawData);
    } catch {
      payload = rawData;
    }
  }

  const normalizedValues = Array.from(
    new Set(
      collectVoicelayStrings(payload)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const duration = extractVoicelayDuration(payload);

  const hasStrongTerminalHint = normalizedValues.some((value) =>
    STRONG_TERMINAL_EVENT_HINTS.some((hint) => value === hint || value.includes(hint))
  );

  const hasWeakTerminalHint = normalizedValues.some((value) =>
    WEAK_TERMINAL_EVENT_HINTS.some((hint) => value === hint || value.includes(hint))
  );

  const isTerminal = hasStrongTerminalHint || (duration !== null && hasWeakTerminalHint);

  // Expose weak terminal separately so callers can accept it when call is established
  const isWeakTerminal = hasWeakTerminalHint && !hasStrongTerminalHint && duration === null;

  // Detect transport/websocket messages to avoid false call-end detection
  const isTransportMessage = normalizedValues.some((value) =>
    TRANSPORT_HINTS.some((hint) => value === hint || value.includes(hint))
  );

  const isIncoming = normalizedValues.some((value) =>
    INCOMING_CALL_HINTS.some((hint) => value === hint || value.includes(hint))
  );

  const callerNumber = isIncoming ? extractCallerNumber(payload) : null;
  const sessionId = extractSessionId(payload);

  return {
    duration,
    isTerminal,
    isWeakTerminal,
    isTransportMessage,
    isIncoming,
    callerNumber,
    sessionId,
    normalizedValues,
  };
};