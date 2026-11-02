import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));
vi.mock('./config', () => ({ CONFIG: { webUrl: '' } }));

describe('compass', () => {
  it('names the direction the wind comes from', async () => {
    const { compass } = await import('./sites');
    expect(compass(0)).toBe('N');
    expect(compass(225)).toBe('SW');
    expect(compass(350)).toBe('N');
    expect(compass(-90)).toBe('W');
  });
});
