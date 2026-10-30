import { describe, expect, it } from 'vitest';
import { base64ToBytes } from './base64';

describe('base64ToBytes', () => {
  it('decodes like Buffer', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'Fly Anatolia ✈︎ 2026']) {
      const b64 = Buffer.from(text).toString('base64');
      expect(Buffer.from(base64ToBytes(b64)).toString()).toBe(text);
    }
  });
});
