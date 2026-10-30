import { describe, expect, it } from 'vitest';
import { noticeSchema, parseNoticeFilters } from './notices';

describe('noticeSchema', () => {
  it('accepts a minimal notice and fills defaults', () => {
    const n = noticeSchema.parse({ kind: 'request', category: 'gear', title: 'Harness arıyorum' });
    expect(n).toMatchObject({ body: null, price: null, currency: null, seats: null });
  });
  it('keeps seats only for transport and defaults the currency to TRY', () => {
    const n = noticeSchema.parse({
      kind: 'offer',
      category: 'gear',
      title: 'Yedek paraşüt',
      seats: '3',
      price: '1250,5',
      currency: '',
    });
    expect(n.seats).toBeNull();
    expect(n.price).toBe(1250.5);
    expect(n.currency).toBe('TRY');
    expect(
      noticeSchema.parse({ kind: 'offer', category: 'transport', title: 'Babadağ', seats: '2' })
        .seats,
    ).toBe(2);
  });
  it('rejects short titles and unknown categories', () => {
    expect(noticeSchema.safeParse({ kind: 'offer', category: 'gear', title: 'x' }).success).toBe(
      false,
    );
    expect(noticeSchema.safeParse({ kind: 'offer', category: 'car', title: 'xyz' }).success).toBe(
      false,
    );
  });
});

describe('parseNoticeFilters', () => {
  it('drops invalid values', () => {
    expect(parseNoticeFilters({ category: 'gear', kind: 'nope', date: '2026-11-01' })).toEqual({
      category: 'gear',
      kind: undefined,
      site: undefined,
      date: '2026-11-01',
    });
  });
});
