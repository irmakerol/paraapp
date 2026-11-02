// A small Markdown reader for club content (news, Ground School, events, trips). It covers what
// the website's editors produce: headings, paragraphs, lists, quotes, rules, bold, italic, code
// and links. Anything else is shown as plain text, never as HTML.

export type Span =
  | { kind: 'text'; text: string; bold?: boolean; italic?: boolean; code?: boolean }
  | { kind: 'link'; text: string; href: string };

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; spans: Span[] }
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'quote'; spans: Span[] }
  | { kind: 'list'; ordered: boolean; items: Span[][] }
  | { kind: 'rule' };

const INLINE =
  /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/** Only web and mail links are followed; anything else stays text. */
export function safeHref(href: string): string | null {
  return /^(https?:\/\/|mailto:)/i.test(href) ? href : null;
}

export function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const token = m[0];
    const at = m.index;
    if (at > last) spans.push({ kind: 'text', text: text.slice(last, at) });
    if (token.startsWith('**') || token.startsWith('__'))
      spans.push({ kind: 'text', text: token.slice(2, -2), bold: true });
    else if (token.startsWith('`'))
      spans.push({ kind: 'text', text: token.slice(1, -1), code: true });
    else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const label = link?.[1] ?? token;
      const href = link?.[2] ? safeHref(link[2]) : null;
      spans.push(href ? { kind: 'link', text: label, href } : { kind: 'text', text: label });
    } else spans.push({ kind: 'text', text: token.slice(1, -1), italic: true });
    last = at + token.length;
  }
  if (last < text.length) spans.push({ kind: 'text', text: text.slice(last) });
  return spans;
}

export function parseMarkdown(source: string | null | undefined): Block[] {
  const blocks: Block[] = [];
  const lines = (source ?? '').replace(/\r\n?/g, '\n').split('\n');
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', spans: parseInline(para.join(' ')) });
    para = [];
    if (list)
      blocks.push({ kind: 'list', ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = Math.min(3, (heading[1] ?? '#').length) as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, spans: parseInline(heading[2] ?? '') });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flush();
      blocks.push({ kind: 'rule' });
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (para.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)?.[1] ?? '');
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flush();
      const prev = blocks.at(-1);
      if (prev?.kind === 'quote')
        prev.spans.push({ kind: 'text', text: ' ' }, ...parseInline(quote[1] ?? ''));
      else blocks.push({ kind: 'quote', spans: parseInline(quote[1] ?? '') });
      continue;
    }
    if (list) {
      // A wrapped list line continues the last item.
      const items = list.items;
      items[items.length - 1] = `${items[items.length - 1] ?? ''} ${line}`;
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}
