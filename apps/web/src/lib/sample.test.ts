import { describe, expect, it } from 'vitest';
import { sampleLabel } from './sample';

describe('sampleLabel', () => {
  it('shows (S) in English and keeps (Ö) in Turkish', () => {
    expect(sampleLabel('Ayşe Demir (Ö)', 'en')).toBe('Ayşe Demir (S)');
    expect(sampleLabel('Ayşe Demir (Ö)', 'tr')).toBe('Ayşe Demir (Ö)');
    expect(sampleLabel('Real name', 'en')).toBe('Real name');
    expect(sampleLabel(null, 'en')).toBeNull();
  });
});
