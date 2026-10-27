import { describe, expect, it } from 'vitest';
import { toIcs, missingRequirements, seatsLeft, tripRegistrationSchema, tripSchema } from './index';

const base = {
  title: 'Ölüdeniz week',
  description_md: '',
  itinerary_md: '',
  starts_on: '2027-05-01',
  ends_on: '2027-05-04',
  max_pilots: '12',
  requirements_md: '',
  price_currency: 'EUR',
  payment_info_md: '',
  status: 'open',
};

describe('trips', () => {
  it('parses a trip form', () => {
    const t = tripSchema.parse({
      ...base,
      price_amount: '450,50',
      min_pilot_level: 'p2',
      destination_country: 'tr',
    });
    expect(t.price_amount).toBe(450.5);
    expect(t.destination_country).toBe('TR');
    expect(t.min_pilots).toBeNull();
    expect(t.members_only).toBe(false);
  });
  it('rejects inconsistent trips', () => {
    expect(tripSchema.safeParse({ ...base, ends_on: '2027-04-30' }).success).toBe(false);
    expect(tripSchema.safeParse({ ...base, min_pilots: '20' }).success).toBe(false);
    expect(
      tripSchema.safeParse({ ...base, price_amount: '100', deposit_amount: '200' }).success,
    ).toBe(false);
  });
  it('checks requirements like the database', () => {
    const trip = { min_pilot_level: 'p3' as const, min_years_flying: 2 };
    expect(missingRequirements(trip, { pilot_level: 'tandem', years_flying: 5 })).toEqual([]);
    expect(missingRequirements(trip, { pilot_level: 'p2', years_flying: 1 })).toEqual([
      'level',
      'years',
    ]);
    expect(missingRequirements(trip, { pilot_level: null, years_flying: null })).toEqual([
      'level',
      'years',
    ]);
    expect(
      missingRequirements(
        { min_pilot_level: null, min_years_flying: null },
        { pilot_level: null, years_flying: null },
      ),
    ).toEqual([]);
  });
  it('counts seats', () => {
    expect(seatsLeft(10, 4)).toBe(6);
    expect(seatsLeft(10, 12)).toBe(0);
  });
  it('requires confirming the requirements to register', () => {
    expect(
      tripRegistrationSchema.safeParse({ phone: '+90 555 000 00 00', emergency_phone: '' }).success,
    ).toBe(false);
    const r = tripRegistrationSchema.parse({
      phone: '+90 555',
      emergency_phone: '',
      confirm: 'on',
      companions: '',
    });
    expect(r.emergency_phone).toBeNull();
    expect(r.companions).toBeNull();
  });
  it('writes all-day calendar entries for trips', () => {
    const ics = toIcs({
      uid: 'x',
      title: 'Trip',
      startsAt: '2027-05-01',
      endsAt: '2027-05-04',
      allDay: true,
    });
    expect(ics).toContain('DTSTART;VALUE=DATE:20270501');
    expect(ics).toContain('DTEND;VALUE=DATE:20270505');
  });
});
