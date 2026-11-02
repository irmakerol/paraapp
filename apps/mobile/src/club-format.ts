// Pure helpers for the Club Messages list (no React Native imports, so vitest can load them).

// Türkiye has kept UTC+3 all year since 2016, so Istanbul time needs no time zone database
// (Hermes' Intl support for `timeZone` differs between versions).
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-30T18:13:00Z" → "30.10.2026 21:13" in Istanbul time. */
export function istanbulDateTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms + ISTANBUL_OFFSET_MS);
  return (
    `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
}

/** The first words of a message as plain text for a one-line preview (Markdown marks removed). */
export function previewText(body: string | null): string {
  if (!body) return '';
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]+/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
