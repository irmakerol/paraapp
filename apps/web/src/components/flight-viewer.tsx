'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { varioSeries, type CompactTrack, type XcScore } from '@paraapp/core';
import { addAirspaceControl, MAP_STYLE, TERRAIN_TILES } from '@/lib/map';
import { MapGate } from './map-gate';

interface Point {
  t: number;
  lat: number;
  lng: number;
  alt: number;
  vario: number;
  /** Ground speed in km/h. */
  speed: number;
}

/** Another pilot's flight from the same day, replayed on the same clock. */
export interface CompanionFlight {
  id: string;
  name: string;
  startedAt: string;
}

interface LoadedCompanion extends CompanionFlight {
  colour: string;
  points: Point[];
}

const SPEEDS = [10, 25, 50, 100] as const;
const COMPANION_COLOURS = ['#7c3aed', '#059669', '#d97706', '#db2777', '#0891b2', '#4d7c0f'];

function groundSpeeds(pts: { t: number; lat: number; lng: number }[]): number[] {
  // Average over about 10 s either side so GPS jitter does not show as speed.
  const rad = Math.PI / 180;
  const metres = (a: (typeof pts)[number], b: (typeof pts)[number]) => {
    const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
    const y = (b.lat - a.lat) * rad;
    return Math.hypot(x, y) * 6_371_000;
  };
  return pts.map((p, i) => {
    let lo = i;
    let hi = i;
    while (lo > 0 && p.t - pts[lo - 1]!.t <= 10_000) lo--;
    while (hi < pts.length - 1 && pts[hi + 1]!.t - p.t <= 10_000) hi++;
    const dt = (pts[hi]!.t - pts[lo]!.t) / 1000;
    return dt > 0 ? (metres(pts[lo]!, pts[hi]!) / dt) * 3.6 : 0;
  });
}

function expand(track: CompactTrack): Point[] {
  const pts = track.points.map(([s, lat, lng, alt]) => ({
    t: track.start + s * 1000,
    lat,
    lng,
    alt,
  }));
  const vario = varioSeries(pts);
  const speed = groundSpeeds(pts);
  return pts.map((p, i) => ({ ...p, vario: vario[i] ?? 0, speed: speed[i] ?? 0 }));
}

/** Index of the last point at or before `time`. */
function indexAt(points: Point[], time: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid]!.t <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Position at `time`, interpolated between fixes so the replay moves smoothly. */
function positionAt(points: Point[], time: number): [number, number] {
  const i = indexAt(points, time);
  const a = points[i]!;
  const b = points[i + 1];
  if (!b || time <= a.t) return [a.lng, a.lat];
  const f = Math.min(1, (time - a.t) / Math.max(1, b.t - a.t));
  return [a.lng + (b.lng - a.lng) * f, a.lat + (b.lat - a.lat) * f];
}

/** Sink blue → neutral grey → climb red. */
function varioColour(v: number): string {
  const c = Math.max(-1, Math.min(1, v / 3));
  if (c >= 0) {
    const g = Math.round(180 - 140 * c);
    return `rgb(${Math.round(150 + 105 * c)},${g},${Math.round(160 - 120 * c)})`;
  }
  const k = -c;
  return `rgb(${Math.round(150 - 110 * k)},${Math.round(180 - 40 * k)},${Math.round(160 + 80 * k)})`;
}

type Elevation = (lngLat: [number, number]) => number | null;

const EMPTY = { type: 'FeatureCollection' as const, features: [] };

/**
 * A small rectangle along a→b, `halfWidth` metres either side and `overhang` metres past each
 * end so neighbouring segments overlap at bends instead of leaving gaps.
 */
function quad(
  a: [number, number],
  b: [number, number],
  halfWidth: number,
  overhang = 0,
): [number, number][] {
  const mLng = 111_320 * Math.cos((a[1] * Math.PI) / 180);
  const dx = (b[0] - a[0]) * mLng;
  const dy = (b[1] - a[1]) * 111_320;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * halfWidth;
  const oy = (dx / len) * halfWidth;
  const ex = (dx / len) * overhang;
  const ey = (dy / len) * overhang;
  const off = (p: [number, number], side: number, end: number): [number, number] => [
    p[0] + (side * ox + end * ex) / mLng,
    p[1] + (side * oy + end * ey) / 111_320,
  ];
  return [off(a, 1, -1), off(b, 1, 1), off(b, -1, 1), off(a, -1, -1), off(a, 1, -1)];
}

/**
 * The track as a ribbon at the height actually flown. Map lines can only lie on the ground,
 * so in 3D each segment is a thin box lifted to its height above the terrain.
 */
function airRibbon(points: Point[], elevation: Elevation) {
  const features = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const ground = elevation([(a.lng + b.lng) / 2, (a.lat + b.lat) / 2]);
    if (ground === null) continue;
    const agl = Math.max(2, (a.alt + b.alt) / 2 - ground);
    features.push({
      type: 'Feature' as const,
      properties: { colour: varioColour(b.vario), base: Math.max(0, agl - 12), height: agl + 4 },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [quad([a.lng, a.lat], [b.lng, b.lat], 10, 10)],
      },
    });
  }
  return { type: 'FeatureCollection' as const, features };
}

/** A thin pole from the ground up to the glider, so its height is easy to read in 3D. */
function heightPole(position: [number, number], alt: number, elevation: Elevation) {
  const ground = elevation(position);
  if (ground === null) return EMPTY;
  const east: [number, number] = [position[0] + 0.0001, position[1]];
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: { height: Math.max(2, alt - ground) },
        geometry: { type: 'Polygon' as const, coordinates: [quad(position, east, 12)] },
      },
    ],
  };
}

export function FlightViewer({
  track,
  trimmed,
  xc,
  companions = [],
}: {
  track: CompactTrack;
  trimmed: boolean;
  /** Scoring geometry, only passed to the owner (it can include takeoff and landing). */
  xc?: XcScore | null;
  companions?: CompanionFlight[];
}) {
  const t = useTranslations('flight');
  const points = useMemo(() => expand(track), [track]);
  const t0 = points[0]?.t ?? 0;
  const t1 = points[points.length - 1]?.t ?? 0;
  const [time, setTime] = useState(t0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(25);
  const [follow, setFollow] = useState(true);
  const [threeD, setThreeD] = useState(false);
  const [others, setOthers] = useState<LoadedCompanion[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const timeRef = useRef(time);
  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  // Playback clock: advances the replay time by real time × speed.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(t1, timeRef.current + (now - last) * speed);
      last = now;
      timeRef.current = next;
      setTime(next);
      if (next >= t1) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, t1]);

  const toggleCompanion = useCallback(
    async (c: CompanionFlight) => {
      if (others.some((o) => o.id === c.id)) {
        setOthers((list) => list.filter((o) => o.id !== c.id));
        return;
      }
      setLoading(c.id);
      setLoadError(false);
      try {
        const res = await fetch(`/api/flights/${c.id}/track`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { track: CompactTrack | null };
        if (!body.track) throw new Error('no track');
        const loaded = expand(body.track);
        setOthers((list) => {
          const used = new Set(list.map((o) => o.colour));
          const colour =
            COMPANION_COLOURS.find((col) => !used.has(col)) ??
            COMPANION_COLOURS[list.length % COMPANION_COLOURS.length]!;
          return [...list, { ...c, colour, points: loaded }];
        });
      } catch {
        setLoadError(true);
      } finally {
        setLoading(null);
      }
    },
    [others],
  );

  if (points.length < 2) return null;
  const index = indexAt(points, time);
  const current = points[index]!;

  return (
    <div className="space-y-3">
      <MapGate className="h-[55vh] min-h-72">
        <TrackMap
          points={points}
          time={time}
          follow={follow && playing}
          threeD={threeD}
          xc={xc ?? null}
          others={others}
          label={t('mapLabel')}
        />
      </MapGate>
      <ReplayControls
        playing={playing}
        atEnd={time >= t1}
        speed={speed}
        follow={follow}
        threeD={threeD}
        onPlay={() => {
          if (time >= t1) setTime(t0);
          setPlaying((p) => !p);
        }}
        onSpeed={setSpeed}
        onFollow={setFollow}
        onThreeD={setThreeD}
      />
      <AltitudeChart
        points={points}
        current={current}
        time={time}
        others={others}
        onTime={(value) => {
          setTime(value);
        }}
      />
      {companions.length ? (
        <fieldset className="rounded-2xl border border-border bg-card p-3">
          <legend className="px-1 text-sm font-semibold">{t('replay.together')}</legend>
          <p className="mb-2 text-xs text-muted">{t('replay.togetherHelp')}</p>
          <ul className="flex flex-wrap gap-2">
            {companions.map((c) => {
              const shown = others.find((o) => o.id === c.id);
              return (
                <li key={c.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={!!shown}
                      disabled={loading === c.id}
                      onChange={() => void toggleCompanion(c)}
                    />
                    {shown ? (
                      <span
                        aria-hidden
                        className="inline-block size-3 rounded-full"
                        style={{ background: shown.colour }}
                      />
                    ) : null}
                    {c.name}
                  </label>
                </li>
              );
            })}
          </ul>
          {loadError ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {t('replay.loadFailed')}
            </p>
          ) : null}
        </fieldset>
      ) : null}
      <p className="text-xs text-muted">
        {trimmed ? `${t('trimmedNote')} ` : ''}
        {t('mapCredit')}
        {threeD ? ` ${t('replay.terrainCredit')}` : ''}
      </p>
    </div>
  );
}

function ReplayControls({
  playing,
  atEnd,
  speed,
  follow,
  threeD,
  onPlay,
  onSpeed,
  onFollow,
  onThreeD,
}: {
  playing: boolean;
  atEnd: boolean;
  speed: number;
  follow: boolean;
  threeD: boolean;
  onPlay: () => void;
  onSpeed: (s: (typeof SPEEDS)[number]) => void;
  onFollow: (v: boolean) => void;
  onThreeD: (v: boolean) => void;
}) {
  const t = useTranslations('flight.replay');
  const pill =
    'min-h-11 rounded-xl border border-border px-3 text-sm font-medium aria-pressed:bg-primary aria-pressed:text-primary-foreground';
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('controls')}>
      <button
        type="button"
        onClick={onPlay}
        className="min-h-11 min-w-28 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
      >
        {playing ? `❚❚ ${t('pause')}` : atEnd ? `↺ ${t('again')}` : `▶ ${t('play')}`}
      </button>
      <div className="flex gap-1" role="group" aria-label={t('speed')}>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={pill}
            aria-pressed={speed === s}
            onClick={() => onSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
      <button
        type="button"
        className={pill}
        aria-pressed={follow}
        onClick={() => onFollow(!follow)}
      >
        {t('follow')}
      </button>
      <button
        type="button"
        className={pill}
        aria-pressed={threeD}
        onClick={() => onThreeD(!threeD)}
      >
        3D
      </button>
    </div>
  );
}

function TrackMap({
  points,
  time,
  follow,
  threeD,
  xc,
  others,
  label,
}: {
  points: Point[];
  time: number;
  follow: boolean;
  threeD: boolean;
  xc: XcScore | null;
  others: LoadedCompanion[];
  label: string;
}) {
  const maps = useTranslations('maps');
  const airspaceLabels = { show: maps('airspace'), attribution: maps('airspaceCredit') };
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const marker = useRef<Marker | null>(null);
  const otherMarkers = useRef(new Map<string, Marker>());
  const maplibre = useRef<typeof import('maplibre-gl') | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !container.current) return;
      maplibre.current = maplibregl;
      const lngs = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      const instance = new maplibregl.Map({
        container: container.current,
        style: MAP_STYLE,
        bounds: [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        fitBoundsOptions: { padding: 40 },
        attributionControl: { compact: true },
        cooperativeGestures: true,
        maxPitch: 75,
      });
      instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
      instance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }));
      addAirspaceControl(instance, airspaceLabels);
      instance.on('load', () => {
        const features = points.slice(1).map((p, i) => ({
          type: 'Feature' as const,
          properties: { colour: varioColour(p.vario) },
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [points[i]!.lng, points[i]!.lat],
              [p.lng, p.lat],
            ],
          },
        }));
        instance.addSource('track', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
        });
        instance.addLayer({
          id: 'track-casing',
          type: 'line',
          source: 'track',
          paint: { 'line-color': '#0f4049', 'line-width': 5, 'line-opacity': 0.5 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        });
        instance.addLayer({
          id: 'track',
          type: 'line',
          source: 'track',
          paint: { 'line-color': ['get', 'colour'], 'line-width': 3 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        });
        instance.addSource('others', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        instance.addLayer({
          id: 'others',
          type: 'line',
          source: 'others',
          paint: { 'line-color': ['get', 'colour'], 'line-width': 2, 'line-opacity': 0.8 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        });
        instance.addSource('xc', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        instance.addLayer({
          id: 'xc',
          type: 'line',
          source: 'xc',
          paint: { 'line-color': '#111827', 'line-width': 2, 'line-dasharray': [2, 2] },
        });
        instance.addSource('air', { type: 'geojson', data: EMPTY });
        instance.addLayer({
          id: 'air',
          type: 'fill-extrusion',
          source: 'air',
          layout: { visibility: 'none' },
          paint: {
            'fill-extrusion-color': ['get', 'colour'],
            'fill-extrusion-base': ['coalesce', ['get', 'base'], 0],
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 0],
            'fill-extrusion-opacity': 0.9,
          },
        });
        instance.addSource('pole', { type: 'geojson', data: EMPTY });
        instance.addLayer({
          id: 'pole',
          type: 'fill-extrusion',
          source: 'pole',
          layout: { visibility: 'none' },
          paint: {
            'fill-extrusion-color': '#de4750',
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 0],
            'fill-extrusion-opacity': 0.8,
          },
        });
        setReady(true);
      });
      const el = document.createElement('div');
      el.className = 'size-4 rounded-full border-2 border-white bg-brand-red shadow';
      marker.current = new maplibregl.Marker({ element: el })
        .setLngLat([points[0]!.lng, points[0]!.lat])
        .addTo(instance);
      map.current = instance;
    });
    const markers = otherMarkers.current;
    return () => {
      cancelled = true;
      markers.clear();
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels only matter on creation
  }, [points]);

  // Scoring geometry (owner only): dashed legs and the closing gap.
  useEffect(() => {
    const source = map.current?.getSource('xc') as GeoJSONSource | undefined;
    if (!ready || !source) return;
    const coords = (xc?.turnpoints ?? []).map((p) => [p.lng, p.lat]);
    const features = [];
    if (coords.length > 1) {
      features.push({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: xc?.type === 'free' ? coords : [...coords, coords[0]!],
        },
      });
    }
    if (xc?.closing) {
      features.push({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: xc.closing.map((p) => [p.lng, p.lat]),
        },
      });
    }
    source.setData({ type: 'FeatureCollection', features });
  }, [ready, xc]);

  // Other pilots' tracks and markers.
  useEffect(() => {
    const instance = map.current;
    const lib = maplibre.current;
    const source = instance?.getSource('others') as GeoJSONSource | undefined;
    if (!ready || !instance || !lib || !source) return;
    source.setData({
      type: 'FeatureCollection',
      features: others.map((o) => ({
        type: 'Feature' as const,
        properties: { colour: o.colour },
        geometry: {
          type: 'LineString' as const,
          coordinates: o.points.map((p) => [p.lng, p.lat]),
        },
      })),
    });
    const markers = otherMarkers.current;
    for (const [id, m] of markers) {
      if (!others.some((o) => o.id === id)) {
        m.remove();
        markers.delete(id);
      }
    }
    for (const o of others) {
      if (markers.has(o.id)) continue;
      const el = document.createElement('div');
      el.className =
        'grid size-6 place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow';
      el.style.background = o.colour;
      el.textContent = o.name.slice(0, 1).toUpperCase();
      el.title = o.name;
      markers.set(
        o.id,
        new lib.Marker({ element: el })
          .setLngLat([o.points[0]!.lng, o.points[0]!.lat])
          .addTo(instance),
      );
    }
  }, [ready, others]);

  // 3D terrain from free elevation tiles, only requested once the pilot turns 3D on.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    if (threeD) {
      if (!instance.getSource('terrain')) {
        instance.addSource('terrain', {
          type: 'raster-dem',
          tiles: [TERRAIN_TILES],
          tileSize: 256,
          encoding: 'terrarium',
          maxzoom: 15,
        });
      }
      // No exaggeration, so the flown heights line up with the terrain.
      instance.setTerrain({ source: 'terrain', exaggeration: 1 });
      instance.easeTo({ pitch: 65, duration: 800 });
      const elevation: Elevation = (p) => instance.queryTerrainElevation(p);
      // Terrain tiles arrive in steps; rebuild the ribbon whenever the map settles.
      const lift = () => {
        (instance.getSource('air') as GeoJSONSource | undefined)?.setData(
          airRibbon(points, elevation),
        );
      };
      instance.on('idle', lift);
      instance.setLayoutProperty('air', 'visibility', 'visible');
      instance.setLayoutProperty('pole', 'visibility', 'visible');
      instance.setPaintProperty('track', 'line-opacity', 0.35);
      instance.setPaintProperty('track-casing', 'line-opacity', 0.15);
      return () => {
        instance.off('idle', lift);
      };
    }
    if (instance.getTerrain()) {
      instance.setTerrain(null);
      instance.easeTo({ pitch: 0, duration: 800 });
    }
    if (instance.getLayer('air')) {
      instance.setLayoutProperty('air', 'visibility', 'none');
      instance.setLayoutProperty('pole', 'visibility', 'none');
      instance.setPaintProperty('track', 'line-opacity', 1);
      instance.setPaintProperty('track-casing', 'line-opacity', 0.5);
    }
  }, [ready, threeD, points]);

  // Move the markers (and the camera when following) to the replay time.
  useEffect(() => {
    const position = positionAt(points, time);
    marker.current?.setLngLat(position);
    const instance = map.current;
    if (threeD && instance?.getTerrain()) {
      (instance.getSource('pole') as GeoJSONSource | undefined)?.setData(
        heightPole(position, points[indexAt(points, time)]!.alt, (p) =>
          instance.queryTerrainElevation(p),
        ),
      );
    }
    for (const o of others) {
      const m = otherMarkers.current.get(o.id);
      const first = o.points[0]!;
      const last = o.points[o.points.length - 1]!;
      if (!m) continue;
      const inAir = time >= first.t && time <= last.t;
      m.getElement().style.opacity = inAir ? '1' : '0.35';
      m.setLngLat(positionAt(o.points, Math.max(first.t, Math.min(last.t, time))));
    }
    if (follow) map.current?.jumpTo({ center: position });
  }, [time, points, others, follow, threeD]);

  return (
    <div
      ref={container}
      className="h-[55vh] min-h-72 w-full overflow-hidden rounded-2xl border border-border"
      role="region"
      aria-label={label}
    />
  );
}

const W = 1000;
const H = 220;

function AltitudeChart({
  points,
  current,
  time,
  others,
  onTime,
}: {
  points: Point[];
  current: Point;
  time: number;
  others: LoadedCompanion[];
  onTime: (time: number) => void;
}) {
  const t = useTranslations('flight');
  const locale = useLocale();
  const svg = useRef<SVGSVGElement>(null);
  const t0 = points[0]!.t;
  const t1 = points[points.length - 1]!.t;
  const alts = [...points, ...others.flatMap((o) => o.points)].map((p) => p.alt);
  const minAlt = Math.min(...alts);
  const maxAlt = Math.max(...alts);
  const span = Math.max(50, maxAlt - minAlt);
  const x = (value: number) => ((value - t0) / Math.max(1, t1 - t0)) * W;
  const y = (alt: number) => H - 10 - ((alt - minAlt) / span) * (H - 30);
  const pathOf = (pts: Point[]) =>
    pts
      .filter((p) => p.t >= t0 && p.t <= t1)
      .map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.alt).toFixed(1)}`)
      .join('');
  const path = pathOf(points);
  const clock = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Istanbul',
  });
  const elapsed = Math.max(0, Math.round((time - t0) / 1000));
  const hms = `${Math.floor(elapsed / 3600)}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  function pick(clientX: number) {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return;
    const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onTime(t0 + f * (t1 - t0));
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap gap-x-4 text-sm tabular-nums" aria-live="off">
        <span>{clock.format(new Date(time))}</span>
        <span>
          {t('replay.elapsed')}: <strong>{hms}</strong>
        </span>
        <span>
          {t('altitude')}: <strong>{Math.round(current.alt)} m</strong>
        </span>
        <span>
          {t('vario')}:{' '}
          <strong style={{ color: varioColour(current.vario) }}>
            {current.vario >= 0 ? '+' : ''}
            {current.vario.toFixed(1)} m/s
          </strong>
        </span>
        <span>
          {t('replay.groundSpeed')}: <strong>{Math.round(current.speed)} km/h</strong>
        </span>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-44 w-full cursor-crosshair touch-none select-none"
        role="slider"
        tabIndex={0}
        aria-label={t('chartLabel')}
        aria-valuemin={0}
        aria-valuemax={Math.round((t1 - t0) / 1000)}
        aria-valuenow={elapsed}
        aria-valuetext={`${clock.format(new Date(time))}, ${Math.round(current.alt)} m`}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === 'mouse') pick(e.clientX);
        }}
        onPointerDown={(e) => pick(e.clientX)}
        onKeyDown={(e) => {
          const step = (e.shiftKey ? 60 : 5) * 1000;
          if (e.key === 'ArrowRight') onTime(Math.min(t1, time + step));
          if (e.key === 'ArrowLeft') onTime(Math.max(t0, time - step));
          if (e.key === 'Home') onTime(t0);
          if (e.key === 'End') onTime(t1);
        }}
      >
        <path d={`${path}L${W},${H}L0,${H}Z`} fill="var(--brand-blue)" opacity="0.15" />
        {others.map((o) => (
          <path
            key={o.id}
            d={pathOf(o.points)}
            fill="none"
            stroke={o.colour}
            strokeWidth="1.5"
            opacity="0.8"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={path}
          fill="none"
          stroke="var(--brand-blue)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={x(time)}
          x2={x(time)}
          y1={0}
          y2={H}
          stroke="var(--brand-red)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <text x="4" y="14" fontSize="12" fill="currentColor" opacity="0.7">
          {maxAlt} m
        </text>
        <text x="4" y={H - 14} fontSize="12" fill="currentColor" opacity="0.7">
          {minAlt} m
        </text>
      </svg>
    </div>
  );
}
