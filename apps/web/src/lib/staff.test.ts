import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/session', () => ({ requireActiveViewer: vi.fn() }));

const { canUse, staffAreas } = await import('./staff');

const viewer = (roles: string[]) => ({ roles }) as unknown as Parameters<typeof canUse>[0];

describe('staff areas', () => {
  it('gives instructors only the tips area', () => {
    expect(staffAreas(viewer(['pilot', 'instructor']))).toEqual(['tips']);
  });
  it('gives moderators tips and reports', () => {
    expect(staffAreas(viewer(['moderator']))).toEqual(['tips', 'reports', 'sites']);
  });
  it('gives admins everything', () => {
    expect(staffAreas(viewer(['admin']))).toHaveLength(6);
  });
  it('gives members nothing', () => {
    expect(canUse(viewer(['member']), 'news')).toBe(false);
    expect(staffAreas(viewer(['member']))).toEqual([]);
  });
});
