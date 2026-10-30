import { describe, expect, it } from 'vitest';
import { istanbulDateTime, previewText } from './club-format';

describe('club message formats', () => {
  it('shows Istanbul time', () => {
    expect(istanbulDateTime('2026-10-30T18:13:00Z')).toBe('30.10.2026 21:13');
    expect(istanbulDateTime('2026-12-31T22:05:00Z')).toBe('01.01.2027 01:05');
    expect(istanbulDateTime('nonsense')).toBe('');
  });

  it('turns Markdown into one plain line', () => {
    expect(
      previewText('# Hafta sonu\n\n**Babadağ** uçuşu [kayıt](https://x.y) için\n- erken gel'),
    ).toBe('Hafta sonu Babadağ uçuşu kayıt için erken gel');
    expect(previewText(null)).toBe('');
  });
});
