import { parseGpx } from './gpx';
import { parseIgc } from './igc';
import type { ParsedTrack } from './types';

export type TrackFormat = 'igc' | 'gpx';

/** Detects the format from the file name or, failing that, the content. */
export function detectFormat(fileName: string, text: string): TrackFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.igc')) return 'igc';
  if (lower.endsWith('.gpx')) return 'gpx';
  const head = text.slice(0, 2000);
  if (/<gpx[\s>]/i.test(head)) return 'gpx';
  if (/^A\w{3}/m.test(head) && /^B\d{6}/m.test(text)) return 'igc';
  return null;
}

export function parseTrack(fileName: string, text: string): ParsedTrack | null {
  const format = detectFormat(fileName, text);
  if (format === 'igc') return parseIgc(text);
  if (format === 'gpx') return parseGpx(text);
  return null;
}
