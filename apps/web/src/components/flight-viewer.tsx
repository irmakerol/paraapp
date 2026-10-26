'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { varioSeries, type CompactTrack } from '@paraapp/core';
import { addAirspaceControl, MAP_STYLE } from '@/lib/map';
import { MapGate } from './map-gate';

interface Point {
  t: number;
  lat: number;
  lng: number;
  alt: number;
  vario: number;
}

function expand(track: CompactTrack): Point[] {
  const pts = track.points.map(([s, lat, lng, alt]) => ({
    t: track.start + s * 1000,
    lat,
    lng,
    alt,
  }));
  const vario = varioSeries(pts);
  return pts.map((p, i) => ({ ...p, vario: vario[i] ?? 0 }));
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

export function FlightViewer({ track, trimmed }: { track: CompactTrack; trimmed: boolean }) {
  const t = useTranslations('flight');
  const points = useMemo(() => expand(track), [track]);
  const [index, setIndex] = useState(0);
  const current = points[index];

  if (points.length < 2 || !current) return null;
  return (
    <div className="space-y-3">
      <MapGate className="h-[55vh] min-h-72">
        <TrackMap points={points} index={index} label={t('mapLabel')} />
      </MapGate>
      <AltitudeChart points={points} index={index} onIndex={setIndex} />
      <p className="text-xs text-muted">
        {trimmed ? `${t('trimmedNote')} ` : ''}
        {t('mapCredit')}
      </p>
    </div>
  );
}

function TrackMap({ points, index, label }: { points: Point[]; index: number; label: string }) {
  const maps = useTranslations('maps');
  const airspaceLabels = { show: maps('airspace'), attribution: maps('airspaceCredit') };
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !container.current) return;
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
      });
      const el = document.createElement('div');
      el.className = 'size-4 rounded-full border-2 border-white bg-brand-red shadow';
      marker.current = new maplibregl.Marker({ element: el })
        .setLngLat([points[0]!.lng, points[0]!.lat])
        .addTo(instance);
      map.current = instance;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels only matter on creation
  }, [points]);

  useEffect(() => {
    const p = points[index];
    if (p) marker.current?.setLngLat([p.lng, p.lat]);
  }, [index, points]);

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
  index,
  onIndex,
}: {
  points: Point[];
  index: number;
  onIndex: (i: number) => void;
}) {
  const t = useTranslations('flight');
  const locale = useLocale();
  const svg = useRef<SVGSVGElement>(null);
  const t0 = points[0]!.t;
  const t1 = points[points.length - 1]!.t;
  const alts = points.map((p) => p.alt);
  const minAlt = Math.min(...alts);
  const maxAlt = Math.max(...alts);
  const span = Math.max(50, maxAlt - minAlt);
  const x = (time: number) => ((time - t0) / Math.max(1, t1 - t0)) * W;
  const y = (alt: number) => H - 10 - ((alt - minAlt) / span) * (H - 30);
  const path = useMemo(
    () =>
      points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.alt).toFixed(1)}`).join(''),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- x/y derive from points
    [points],
  );
  const current = points[index]!;
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Istanbul',
  });

  function pick(clientX: number) {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return;
    const target = t0 + ((clientX - rect.left) / rect.width) * (t1 - t0);
    let lo = 0;
    let hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid]!.t < target) lo = mid + 1;
      else hi = mid;
    }
    onIndex(lo);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap gap-x-4 text-sm tabular-nums" aria-live="polite">
        <span>{time.format(new Date(current.t))}</span>
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
        aria-valuemax={points.length - 1}
        aria-valuenow={index}
        aria-valuetext={`${time.format(new Date(current.t))}, ${Math.round(current.alt)} m`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 30 : 1;
          if (e.key === 'ArrowRight') onIndex(Math.min(points.length - 1, index + step));
          if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - step));
        }}
      >
        <path d={`${path}L${W},${H}L0,${H}Z`} fill="var(--brand-blue)" opacity="0.15" />
        <path
          d={path}
          fill="none"
          stroke="var(--brand-blue)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={x(current.t)}
          x2={x(current.t)}
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
