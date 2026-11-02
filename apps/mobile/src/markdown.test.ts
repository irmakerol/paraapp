import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('reads headings, paragraphs, lists and quotes', () => {
    const blocks = parseMarkdown(
      '# Title\n\nFirst line\nsecond line\n\n- one\n- two\n\n1. a\n2. b\n\n> careful\n\n---',
    );
    expect(blocks.map((b) => b.kind)).toEqual([
      'heading',
      'paragraph',
      'list',
      'list',
      'quote',
      'rule',
    ]);
    expect(blocks[1]).toEqual({
      kind: 'paragraph',
      spans: [{ kind: 'text', text: 'First line second line' }],
    });
    const ordered = blocks[3];
    expect(ordered?.kind === 'list' && ordered.ordered).toBe(true);
  });

  it('reads bold, italic, code and safe links only', () => {
    expect(parseInline('a **b** _c_ `d` [e](https://x.org) [f](javascript:alert(1))')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'text', text: 'b', bold: true },
      { kind: 'text', text: ' ' },
      { kind: 'text', text: 'c', italic: true },
      { kind: 'text', text: ' ' },
      { kind: 'text', text: 'd', code: true },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'e', href: 'https://x.org' },
      { kind: 'text', text: ' ' },
      { kind: 'text', text: 'f' },
      { kind: 'text', text: ')' },
    ]);
  });

  it('handles empty input', () => {
    expect(parseMarkdown(null)).toEqual([]);
  });
});
