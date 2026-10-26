import type { TrackPoint } from './types';

const XML_ENTITIES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
};
const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => XML_ENTITIES[c] ?? c);

export function toGpx(points: TrackPoint[], name: string, creator = 'ParaApp'): string {
  const pts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${Math.round(p.alt)}</ele><time>${new Date(p.t).toISOString()}</time></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${xml(creator)}" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${xml(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function toKml(points: TrackPoint[], name: string): string {
  const coords = points
    .map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)},${Math.round(p.alt)}`)
    .join(' ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xml(name)}</name>
    <Style id="track"><LineStyle><color>ff3586ee</color><width>3</width></LineStyle></Style>
    <Placemark>
      <name>${xml(name)}</name>
      <styleUrl>#track</styleUrl>
      <LineString>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>
`;
}

export function toCsv(points: TrackPoint[]): string {
  const rows = points.map(
    (p) =>
      `${new Date(p.t).toISOString()},${p.lat.toFixed(6)},${p.lng.toFixed(6)},${Math.round(p.alt)}`,
  );
  return ['time_utc,latitude,longitude,altitude_m', ...rows].join('\n') + '\n';
}

const pad = (n: number, width: number) => String(Math.abs(Math.round(n))).padStart(width, '0');

function igcCoord(value: number, degWidth: number, pos: string, neg: string): string {
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  let minutesThousandths = Math.round((abs - deg) * 60_000);
  if (minutesThousandths === 60_000) {
    deg += 1;
    minutesThousandths = 0;
  }
  return `${pad(deg, degWidth)}${pad(minutesThousandths, 5)}${value < 0 ? neg : pos}`;
}

/**
 * A plain IGC rebuilt from points (no security record, so not valid for competitions).
 * Used when the flight was imported from GPX or the original file is not shared.
 */
export function toIgc(
  points: TrackPoint[],
  meta: { pilot?: string; glider?: string } = {},
): string {
  const first = points[0];
  const d = first ? new Date(first.t) : new Date(0);
  const lines = [
    'AXXXParaApp',
    `HFDTEDATE:${pad(d.getUTCDate(), 2)}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCFullYear() % 100, 2)},01`,
    `HFPLTPILOTINCHARGE:${(meta.pilot ?? '').replace(/[\r\n]/g, ' ')}`,
    `HFGTYGLIDERTYPE:${(meta.glider ?? '').replace(/[\r\n]/g, ' ')}`,
    'HFDTM100GPSDATUM:WGS-1984',
  ];
  for (const p of points) {
    const t = new Date(p.t);
    const alt = Math.max(-9999, Math.min(99999, Math.round(p.alt)));
    const altText = alt < 0 ? `-${pad(alt, 4)}` : pad(alt, 5);
    lines.push(
      `B${pad(t.getUTCHours(), 2)}${pad(t.getUTCMinutes(), 2)}${pad(t.getUTCSeconds(), 2)}` +
        `${igcCoord(p.lat, 2, 'N', 'S')}${igcCoord(p.lng, 3, 'E', 'W')}A${altText}${altText}`,
    );
  }
  return lines.join('\r\n') + '\r\n';
}
