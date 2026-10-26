import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { decryptField, encryptField } = await import('./crypto');

const key = randomBytes(32).toString('base64');

describe('field encryption', () => {
  it('round-trips and never stores plain text', () => {
    const enc = encryptField('TR-12345', key);
    expect(enc).not.toContain('TR-12345');
    expect(decryptField(enc, key)).toBe('TR-12345');
  });
  it('uses a fresh IV every time', () => {
    expect(encryptField('same', key)).not.toBe(encryptField('same', key));
  });
  it('rejects tampered data and wrong keys', () => {
    const enc = encryptField('secret', key);
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'BB' : 'AA');
    expect(() => decryptField(tampered, key)).toThrow();
    expect(() => decryptField(enc, randomBytes(32).toString('base64'))).toThrow();
  });
  it('rejects short keys', () => {
    expect(() => encryptField('x', randomBytes(16).toString('base64'))).toThrow();
  });
});
