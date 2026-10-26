import type { ParsedTrack, TrackPoint } from './types';

/**
 * Parses an IGC flight recorder file (FAI format). Uses GNSS altitude when the logger
 * records it, otherwise pressure altitude. Handles flights that cross midnight UTC.
 */
export function parseIgc(text: string): ParsedTrack {
  const lines = text.split(/\r?\n/);
  let date: number | null = null;
  let pilot: string | undefined;
  let glider: string | undefined;
  const points: TrackPoint[] = [];
  let dayOffset = 0;
  let lastSeconds = -1;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('H')) {
      const upper = line.toUpperCase();
      const dateMatch = /^H[FOP]DTE(?:DATE)?:?(\d{2})(\d{2})(\d{2})/.exec(upper);
      if (dateMatch) {
        const [, dd, mm, yy] = dateMatch;
        const year = 2000 + Number(yy);
        date = Date.UTC(year, Number(mm) - 1, Number(dd));
      } else if (/^H[FOP]PLT/.test(upper)) {
        pilot = valueOf(line);
      } else if (/^H[FOP]GTY/.test(upper)) {
        glider = valueOf(line);
      }
      continue;
    }
    if (!line.startsWith('B') || line.length < 35 || date === null) continue;
    const m =
      /^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{5})([NS])(\d{3})(\d{5})([EW])([AV])([-\d]\d{4})([-\d]\d{4})/.exec(
        line,
      );
    if (!m) continue;
    const [, hh, mi, ss, latD, latM, ns, lngD, lngM, ew, , pressure, gnss] = m;
    const seconds = Number(hh) * 3600 + Number(mi) * 60 + Number(ss);
    if (lastSeconds >= 0 && seconds < lastSeconds - 3600) dayOffset += 86_400_000;
    lastSeconds = seconds;
    let lat = Number(latD) + Number(latM) / 60_000;
    let lng = Number(lngD) + Number(lngM) / 60_000;
    if (ns === 'S') lat = -lat;
    if (ew === 'W') lng = -lng;
    const gnssAlt = Number(gnss);
    const alt = gnssAlt !== 0 ? gnssAlt : Number(pressure);
    points.push({ t: date + dayOffset + seconds * 1000, lat, lng, alt });
  }
  return { source: 'igc', points, pilot, glider };
}

function valueOf(line: string): string | undefined {
  const i = line.indexOf(':');
  const value = (i >= 0 ? line.slice(i + 1) : '').trim();
  return value && !/^(NIL|NONE|-+)$/i.test(value) ? value.slice(0, 80) : undefined;
}
