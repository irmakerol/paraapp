import { describe, expect, it } from 'vitest';
import tr from './tr.json';
import en from './en.json';

type Tree = { [key: string]: string | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [prefix + k] : keys(v, `${prefix}${k}.`),
  );
}

function badKeys(tree: Tree, path = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => [
    ...(k.includes('.') ? [`${path}${k}`] : []),
    ...(typeof v === 'string' ? [] : badKeys(v, `${path}${k}/`)),
  ]);
}

describe('messages', () => {
  it('Turkish and English have the same keys', () => {
    expect(keys(en as Tree).sort()).toEqual(keys(tr as Tree).sort());
  });
  it('no key contains a dot (next-intl reads dots as nesting)', () => {
    expect(badKeys(tr as Tree)).toEqual([]);
    expect(badKeys(en as Tree)).toEqual([]);
  });
});
