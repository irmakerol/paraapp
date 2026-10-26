import { describe, expect, it } from 'vitest';
import { csvField, csvRow } from './csv';

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
  });
  it('defuses formulas but keeps negative numbers', () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField(-2.5)).toBe('-2.5');
  });
  it('joins rows and leaves empty values blank', () => {
    expect(csvRow(['x', null, 3, undefined])).toBe('x,,3,');
  });
});
