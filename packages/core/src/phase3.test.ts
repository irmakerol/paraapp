import { describe, expect, it } from 'vitest';
import {
  angleDiff,
  dailySummary,
  eventSchema,
  incidentSchema,
  rateForecast,
  rateHour,
  toDms,
  toIcs,
  windFits,
} from './index';

const base = {
  time: '2026-10-27T12:00',
  windKmh: 12,
  gustKmh: 18,
  directionDeg: 200,
  temperature: 20,
  precipitation: 0,
  cape: 100,
};

describe('flyability', () => {
  it('measures angles across north', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(20);
  });
  it('matches the site wind directions', () => {
    expect(windFits(200, ['S', 'SW'])).toBe(true);
    expect(windFits(20, ['S', 'SW'])).toBe(false);
    expect(windFits(20, [])).toBe(true);
  });
  it('rates a nice hour as good', () => {
    expect(rateHour(base, ['S']).rating).toBe('good');
  });
  it('flags rain, strong wind, gusts and cross wind', () => {
    expect(rateHour({ ...base, precipitation: 1 }, ['S']).reasons).toContain('rain');
    expect(rateHour({ ...base, windKmh: 30, gustKmh: 35 }, ['S']).rating).toBe('no');
    expect(rateHour({ ...base, windKmh: 10, gustKmh: 28 }, ['S']).reasons).toContain('gusty');
    expect(rateHour({ ...base, directionDeg: 0 }, ['S']).reasons).toContain('crossWind');
  });
  it('treats light cross wind as fine and strong-ish wind as marginal', () => {
    expect(rateHour({ ...base, windKmh: 5, gustKmh: 8, directionDeg: 0 }, ['S']).rating).toBe(
      'good',
    );
    expect(rateHour({ ...base, windKmh: 20, gustKmh: 24 }, ['S']).rating).toBe('marginal');
  });
  it('summarises days by flying hours', () => {
    const hours = rateForecast(
      {
        time: ['2026-10-27T06:00', '2026-10-27T12:00', '2026-10-28T12:00'],
        temperature_2m: [10, 20, 20],
        precipitation: [0, 0, 3],
        cloud_cover: [0, 0, 100],
        wind_speed_10m: [5, 10, 10],
        wind_direction_10m: [180, 180, 180],
        wind_gusts_10m: [8, 15, 15],
        cape: [0, 0, 0],
      },
      ['S'],
    );
    expect(dailySummary(hours)).toEqual([
      { date: '2026-10-27', rating: 'good', goodHours: 1 },
      { date: '2026-10-28', rating: 'no', goodHours: 0 },
    ]);
  });
});

describe('incident schema', () => {
  const valid = {
    anonymity: 'fully_anonymous',
    occurred_on: '2026-10-20',
    site_id: '',
    category: 'collapse',
    severity: 'minor',
    description: 'A long enough description of what happened.',
    contact_ok: 'on',
  };
  it('never keeps a contact flag on fully anonymous reports', () => {
    const r = incidentSchema.parse(valid);
    expect(r.contact_ok).toBe(false);
    expect(r.site_id).toBeNull();
  });
  it('requires consent for injury details', () => {
    expect(incidentSchema.safeParse({ ...valid, injury_details: 'Broken ankle' }).success).toBe(
      false,
    );
    const ok = incidentSchema.parse({
      ...valid,
      injury_details: 'Broken ankle',
      special_category_consent: 'on',
    });
    expect(ok.injury_details).toBe('Broken ankle');
  });
});

describe('events', () => {
  it('rejects an end before the start', () => {
    const r = eventSchema.safeParse({
      title: 'Trip',
      description_md: '',
      kind: 'club_trip',
      starts_at: '2026-11-01T10:00',
      ends_at: '2026-11-01T09:00',
      status: 'published',
    });
    expect(r.success).toBe(false);
  });
  it('writes a valid calendar file with escaping and folding', () => {
    const ics = toIcs({
      uid: 'e1@paraapp',
      title: 'Babadağ trip; bring a reserve',
      description: 'Meet at the landing, then drive up. '.repeat(4),
      startsAt: '2026-11-01T07:00:00Z',
      endsAt: '2026-11-01T15:00:00Z',
      stamp: '2026-10-26T00:00:00Z',
    });
    expect(ics).toContain('DTSTART:20261101T070000Z');
    expect(ics).toContain('SUMMARY:Babadağ trip\\; bring a reserve');
    for (const line of ics.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});

describe('SOS helpers', () => {
  it('formats degrees, minutes and seconds', () => {
    expect(toDms(36.55231, 29.1619)).toBe(`36°33'08.3"N 29°09'42.8"E`);
    expect(toDms(-1.5, -0.25)).toBe(`1°30'00.0"S 0°15'00.0"W`);
  });
});
