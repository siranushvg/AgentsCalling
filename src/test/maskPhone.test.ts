import { describe, it, expect } from 'vitest';
import { maskPhone } from '@/lib/maskPhone';

describe('maskPhone', () => {
  it('masks a standard 10-digit number', () => {
    const result = maskPhone('9876543210');
    expect(result).toContain('43210');
    expect(result).toContain('*');
    expect(result).not.toBe('9876543210');
  });

  it('masks a 12-digit number with country code', () => {
    const result = maskPhone('919876543210');
    expect(result).toContain('43210');
  });

  it('handles empty string', () => {
    const result = maskPhone('');
    expect(result).toBeDefined();
  });

  it('handles undefined/null gracefully', () => {
    const result = maskPhone(undefined as unknown as string);
    expect(result).toBeDefined();
  });

  it('preserves last 5 digits', () => {
    const result = maskPhone('1234567890');
    expect(result.endsWith('67890')).toBe(true);
  });
});
