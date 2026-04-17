import { describe, expect, it } from 'vitest';

import { parseVoicelayMessage } from '@/hooks/voicelayMessageUtils';

describe('parseVoicelayMessage', () => {
  it('detects terminal events buried in nested payloads', () => {
    const result = parseVoicelayMessage({
      payload: [
        { type: 'live_status' },
        {
          details: {
            reason: 'No live call',
            connected_duration: '87',
          },
        },
      ],
    });

    expect(result.isTerminal).toBe(true);
    expect(result.duration).toBe(87);
    expect(result.normalizedValues).toContain('no live call');
  });

  it('detects terminal plain-string messages', () => {
    expect(parseVoicelayMessage('Call disconnected').isTerminal).toBe(true);
  });

  it('ignores generic disconnected messages that do not prove the live call ended', () => {
    const result = parseVoicelayMessage({
      type: 'transport',
      status: 'disconnected',
      message: 'Websocket disconnected while switching views',
    });

    expect(result.isTerminal).toBe(false);
    // But it IS a weak terminal hint (just not accepted by default)
    expect(result.isWeakTerminal).toBe(true);
    // And it IS a transport message
    expect(result.isTransportMessage).toBe(true);
  });

  it('detects bare disconnected as weak terminal (accepted when call is established)', () => {
    const result = parseVoicelayMessage({
      status: 'disconnected',
    });

    expect(result.isTerminal).toBe(false);
    expect(result.isWeakTerminal).toBe(true);
    expect(result.isTransportMessage).toBe(false);
  });

  it('treats ambiguous terminal statuses as valid only when duration data exists', () => {
    const result = parseVoicelayMessage({
      status: 'completed',
      details: {
        connected_duration: '42',
      },
    });

    expect(result.isTerminal).toBe(true);
    expect(result.duration).toBe(42);
  });

  it('ignores non-terminal payloads', () => {
    expect(
      parseVoicelayMessage({
        status: 'ringing',
        data: { message: 'Customer leg is dialing' },
      }).isTerminal
    ).toBe(false);
  });
});