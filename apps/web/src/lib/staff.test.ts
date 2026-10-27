import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/session', () => ({ requireActiveViewer: vi.fn() }));

const { canUse, staffAreas } = await import('./staff');

const viewer = (roles: string[]) => ({ roles }) as unknown as Parameters<typeof canUse>[0];

describe('staff areas', () => {
  it('gives instructors tips, events and trips', () => {
    expect(staffAreas(viewer(['pilot', 'instructor']))).toEqual(['tips', 'events', 'trips']);
  });
  it('gives moderators tips and reports', () => {
    expect(staffAreas(viewer(['moderator']))).toEqual(['tips', 'reports', 'sites']);
  });
  it('gives admins every area except incident reports', () => {
    expect(staffAreas(viewer(['admin']))).toHaveLength(8);
  });
  it('keeps incident reports for safety officers only', () => {
    expect(canUse(viewer(['admin']), 'safety')).toBe(false);
    expect(staffAreas(viewer(['safety_officer']))).toEqual(['safety']);
  });
  it('gives trip organisers only trips', () => {
    expect(staffAreas(viewer(['trip_organiser']))).toEqual(['trips']);
  });
  it('gives members nothing', () => {
    expect(canUse(viewer(['member']), 'news')).toBe(false);
    expect(staffAreas(viewer(['member']))).toEqual([]);
  });
});
