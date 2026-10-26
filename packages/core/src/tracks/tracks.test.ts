import { at } from './at';
import { describe, expect, it } from 'vitest';
import {
  analyseTrack,
  detectFormat,
  distance,
  fromCompact,
  parseGpx,
  parseIgc,
  parseTrack,
  toCompact,
  toCsv,
  toGpx,
  toIgc,
  toKml,
  trimEnds,
  downsample,
  type TrackPoint,
} from './index';

const T0 = Date.UTC(2026, 5, 14, 9, 0, 0);
// Babadağ-ish launch area.
const LAT0 = 36.53;
const LNG0 = 29.19;

/** 2 min standing, 20 min flying east at 10 m/s climbing then sinking, 2 min standing. */
function syntheticFlight(): TrackPoint[] {
  const points: TrackPoint[] = [];
  const mPerDegLng = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
  for (let s = 0; s < 120; s++) points.push({ t: T0 + s * 1000, lat: LAT0, lng: LNG0, alt: 1700 });
  for (let s = 0; s <= 1200; s++) {
    const climb = s < 600 ? s * 1.5 : 900 - (s - 600) * 3;
    points.push({
      t: T0 + (120 + s) * 1000,
      lat: LAT0,
      lng: LNG0 + (s * 10) / mPerDegLng,
      alt: 1700 + climb,
    });
  }
  const end = at(points, points.length - 1);
  for (let s = 1; s <= 120; s++) points.push({ ...end, t: end.t + s * 1000 });
  return points;
}

describe('IGC', () => {
  it('parses header and B records', () => {
    const igc = [
      'AXCT123',
      'HFDTEDATE:140626,01',
      'HFPLTPILOTINCHARGE:Ayşe Pilot',
      'HFGTYGLIDERTYPE:Ozone Rush 6',
      'B0900003632000N02911400EA0170001720',
      'B0900013632001N02911401EA0170101721',
    ].join('\r\n');
    const track = parseIgc(igc);
    expect(track.pilot).toBe('Ayşe Pilot');
    expect(track.glider).toBe('Ozone Rush 6');
    expect(track.points).toHaveLength(2);
    expect(at(track.points, 0).t).toBe(T0);
    expect(at(track.points, 0).lat).toBeCloseTo(36.5333, 4);
    expect(at(track.points, 0).lng).toBeCloseTo(29.19, 4);
    expect(at(track.points, 0).alt).toBe(1720); // GNSS altitude preferred
  });

  it('handles flights that cross midnight UTC', () => {
    const track = parseIgc(
      [
        'HFDTE140626',
        'B2359593632000N02911400EA0170001720',
        'B0000013632000N02911400EA0170001720',
      ].join('\n'),
    );
    expect(at(track.points, 1).t - at(track.points, 0).t).toBe(2000);
  });

  it('round-trips through the exporter', () => {
    const points = syntheticFlight();
    const back = parseIgc(toIgc(points, { pilot: 'P', glider: 'G' }));
    expect(back.points).toHaveLength(points.length);
    expect(at(back.points, 500).lat).toBeCloseTo(at(points, 500).lat, 4);
    expect(at(back.points, 500).lng).toBeCloseTo(at(points, 500).lng, 4);
    expect(at(back.points, 500).t).toBe(at(points, 500).t);
  });
});

describe('GPX', () => {
  it('round-trips and ignores points without time', () => {
    const points = syntheticFlight().slice(0, 50);
    const gpx = toGpx(points, 'Test <flight>');
    expect(gpx).toContain('Test &lt;flight&gt;');
    const withUntimed = gpx.replace(
      '<trkseg>',
      '<trkseg><trkpt lat="1" lon="2"><ele>3</ele></trkpt>',
    );
    const back = parseGpx(withUntimed);
    expect(back.points).toHaveLength(50);
    expect(at(back.points, 10).alt).toBe(Math.round(at(points, 10).alt));
  });
});

describe('format detection', () => {
  it('uses the extension, then the content', () => {
    expect(detectFormat('a.IGC', '')).toBe('igc');
    expect(detectFormat('track', '<?xml?><gpx version="1.1">')).toBe('gpx');
    expect(detectFormat('x.txt', 'hello')).toBeNull();
    expect(parseTrack('x.txt', 'hello')).toBeNull();
  });
});

describe('analyseTrack', () => {
  const analysed = analyseTrack(syntheticFlight());
  if (!analysed) throw new Error('no flight');
  const result = analysed;

  it('finds takeoff and landing', () => {
    // Takeoff within a few seconds of the start of movement, landing near the stop.
    expect(Math.abs(result.stats.startedAt - (T0 + 120_000))).toBeLessThanOrEqual(15_000);
    expect(Math.abs(result.stats.endedAt - (T0 + 1320_000))).toBeLessThanOrEqual(15_000);
    expect(result.stats.durationS).toBeGreaterThan(1150);
    expect(result.stats.durationS).toBeLessThan(1230);
  });

  it('computes distances, altitudes and vario', () => {
    expect(result.stats.straightM).toBeGreaterThan(11_500);
    expect(result.stats.straightM).toBeLessThan(12_100);
    expect(result.stats.distanceM).toBeGreaterThanOrEqual(result.stats.straightM - 50);
    expect(result.stats.maxAltM).toBe(2600);
    expect(result.stats.maxClimbMs).toBeCloseTo(1.5, 1);
    expect(result.stats.maxSinkMs).toBeCloseTo(-3, 1);
  });

  it('rejects tiny or empty tracks', () => {
    expect(analyseTrack([])).toBeNull();
  });

  it('drops GPS glitches', () => {
    const pts = syntheticFlight();
    pts[700] = { ...at(pts, 700), lat: at(pts, 700).lat + 1 }; // 111 km jump in 1 s
    expect(analyseTrack(pts)?.stats.maxFromTakeoffM).toBeLessThan(13_000);
  });
});

describe('trimEnds', () => {
  it('hides the first and last 500 m', () => {
    const pts = analyseTrack(syntheticFlight())?.points ?? [];
    const trimmed = trimEnds(pts, 500);
    expect(distance(at(pts, 0), at(trimmed, 0))).toBeGreaterThanOrEqual(500);
    expect(
      distance(at(pts, pts.length - 1), at(trimmed, trimmed.length - 1)),
    ).toBeGreaterThanOrEqual(500);
  });

  it('returns nothing when the whole flight stays close', () => {
    const pts = syntheticFlight().slice(0, 150);
    expect(trimEnds(pts, 500)).toEqual([]);
  });
});

describe('compact form and other exports', () => {
  it('round-trips', () => {
    const pts = downsample(syntheticFlight(), 100);
    expect(pts.length).toBeLessThanOrEqual(101);
    const back = fromCompact(toCompact(pts));
    expect(at(back, 5).t).toBe(at(pts, 5).t);
    expect(at(back, 5).lat).toBeCloseTo(at(pts, 5).lat, 5);
  });

  it('writes KML and CSV', () => {
    const pts = syntheticFlight().slice(0, 3);
    expect(toKml(pts, 'a & b')).toContain('<name>a &amp; b</name>');
    const csv = toCsv(pts).trim().split('\n');
    expect(csv[0]).toBe('time_utc,latitude,longitude,altitude_m');
    expect(csv).toHaveLength(4);
  });
});
