import { describe, expect, it } from 'vitest';
import {
  dueStatus,
  equipmentSchema,
  formatDistance,
  formatDuration,
  manualFlightSchema,
  nextDueDate,
} from './flights';

describe('equipment due dates', () => {
  it('adds months and clamps to month end', () => {
    expect(nextDueDate('2026-01-15', 12)).toBe('2027-01-15');
    expect(nextDueDate('2026-08-31', 6)).toBe('2027-02-28');
    expect(nextDueDate(null, 6)).toBeNull();
  });
  it('classifies due dates', () => {
    expect(dueStatus('2026-10-01', '2026-10-26')).toBe('overdue');
    expect(dueStatus('2026-11-05', '2026-10-26')).toBe('soon');
    expect(dueStatus('2027-01-01', '2026-10-26')).toBe('ok');
    expect(dueStatus(null, '2026-10-26')).toBeNull();
  });
});

describe('schemas', () => {
  it('requires a positive duration for manual flights', () => {
    const base = { date: '2026-06-14', time: '10:30', visibility: 'public', site_name: 'Babadağ' };
    expect(manualFlightSchema.safeParse({ ...base, hours: '0', minutes: '0' }).success).toBe(false);
    const ok = manualFlightSchema.safeParse({ ...base, hours: '1', minutes: '5', wing_id: '' });
    expect(ok.success && ok.data.wing_id).toBeNull();
  });
  it('coerces optional equipment fields', () => {
    const r = equipmentSchema.parse({
      kind: 'reserve',
      model: 'SQR',
      repack_interval_months: '12',
      last_repack_on: '',
    });
    expect(r.repack_interval_months).toBe(12);
    expect(r.last_repack_on).toBeNull();
  });
});

describe('formatting', () => {
  it('formats durations and distances', () => {
    expect(formatDuration(5400)).toBe('1:30');
    expect(formatDuration(59)).toBe('0:01');
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(42195, 'en')).toBe('42.2 km');
    expect(formatDistance(null)).toBe('–');
  });
});
