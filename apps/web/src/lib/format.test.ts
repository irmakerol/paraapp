import { describe, expect, it } from 'vitest';
import { formatPrice, isoToIstanbulLocal, istanbulLocalToIso } from './format';

describe('format', () => {
  it('round-trips Istanbul local times', () => {
    const iso = istanbulLocalToIso('2026-11-01T09:30');
    expect(iso).toBe('2026-11-01T06:30:00.000Z');
    expect(isoToIstanbulLocal(iso)).toBe('2026-11-01T09:30');
  });

  it('rejects malformed input', () => {
    expect(istanbulLocalToIso('tomorrow')).toBeNull();
    expect(isoToIstanbulLocal(null)).toBe('');
  });

  it('formats prices without needless decimals', () => {
    expect(formatPrice(1500, 'EUR', 'en')).toBe('€1,500');
    expect(formatPrice(99.5, 'USD', 'en')).toBe('$99.50');
  });
});
