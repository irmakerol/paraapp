import type { ParsedTrack, TrackPoint } from './types';

/**
 * Parses track points from a GPX 1.0/1.1 file. Deliberately small: reads <trkpt> (and
 * <rtept> as a fallback) with their <ele> and <time>; ignores everything else.
 * Points without a time are skipped, since a flight needs timing.
 */
export function parseGpx(text: string): ParsedTrack {
  const points: TrackPoint[] = [];
  const pointRe = /<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  let match: RegExpExecArray | null;
  while ((match = pointRe.exec(text))) {
    const attrs = match[2] ?? '';
    const body = match[3] ?? '';
    const lat = Number(/\blat\s*=\s*["']([^"']+)["']/.exec(attrs)?.[1]);
    const lng = Number(/\blon\s*=\s*["']([^"']+)["']/.exec(attrs)?.[1]);
    const ele = Number(/<ele>\s*([^<]+?)\s*<\/ele>/.exec(body)?.[1] ?? NaN);
    const time = /<time>\s*([^<]+?)\s*<\/time>/.exec(body)?.[1];
    const t = time ? Date.parse(time) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(t)) continue;
    points.push({ t, lat, lng, alt: Number.isFinite(ele) ? ele : 0 });
  }
  return { source: 'gpx', points };
}
