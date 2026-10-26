import { ImageResponse } from 'next/og';
import { APP_CONFIG, formatDistance, formatDuration, type CompactTrack } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { displayNames } from '@/lib/people';
import { getFlight, siteLabel } from '@/lib/flights';
import { formatDate } from '@/lib/format';

const W = 1200;
const H = 630;

/** SVG path of the track, fitted into a box (equirectangular with a latitude correction). */
function trackPath(
  track: CompactTrack | null,
  box: { x: number; y: number; w: number; h: number },
) {
  const pts = track?.points ?? [];
  if (pts.length < 2) return null;
  const lats = pts.map((p) => p[1]);
  const lngs = pts.map((p) => p[2]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * k, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min(box.w / spanX, box.h / spanY);
  const ox = box.x + (box.w - spanX * scale) / 2;
  const oy = box.y + (box.h - spanY * scale) / 2;
  return pts
    .map((p, i) => {
      const x = ox + (p[2] - minLng) * k * scale;
      const y = oy + (maxLat - p[1]) * scale;
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Share image for a flight. Always drawn from the trimmed public track, never the full one,
 * so a shared picture cannot reveal where the pilot started or landed.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flight = await getFlight(id);
  if (!flight) return new Response('Not found', { status: 404 });
  const locale = new URL(request.url).searchParams.get('locale') === 'en' ? 'en' : 'tr';
  const supabase = await createClient();
  const pilot = (await displayNames(supabase, [flight.user_id])).get(flight.user_id) ?? '';
  const path = trackPath(flight.public_track as CompactTrack | null, {
    x: 700,
    y: 60,
    w: 440,
    h: 510,
  });

  const stats = [
    formatDuration(flight.duration_s),
    flight.distance_m != null ? formatDistance(flight.distance_m, locale) : null,
    flight.max_alt_m != null ? `${flight.max_alt_m} m` : null,
  ].filter(Boolean);

  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: 'flex',
        background: '#0f4049',
        color: 'white',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', padding: 60, width: 660 }}>
        <div style={{ fontSize: 28, color: '#f6c850', fontWeight: 700 }}>{APP_CONFIG.name}</div>
        <div style={{ fontSize: 64, fontWeight: 800, marginTop: 40, lineHeight: 1.1 }}>
          {siteLabel(flight) ?? '–'}
        </div>
        <div style={{ fontSize: 32, marginTop: 16, color: '#cfe0e2' }}>
          {[formatDate(flight.started_at, locale), pilot].filter(Boolean).join(' · ')}
        </div>
        <div style={{ display: 'flex', gap: 40, marginTop: 'auto', fontSize: 48, fontWeight: 800 }}>
          {stats.map((s) => (
            <div key={s}>{s}</div>
          ))}
        </div>
      </div>
      {path ? (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          <path
            d={path}
            fill="none"
            stroke="#ee8a35"
            strokeWidth={6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </div>,
    {
      width: W,
      height: H,
      headers: {
        'Cache-Control':
          flight.visibility === 'public'
            ? 'public, max-age=3600, s-maxage=86400'
            : 'private, no-store',
      },
    },
  );
}
