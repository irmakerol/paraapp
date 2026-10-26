'use client';
import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { addAirspaceControl, MAP_STYLE } from '@/lib/map';
import { MapGate } from './map-gate';

export interface SiteMarker {
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

/** Sites as markers; each links to its page. Loads only after the user agrees (MapGate). */
export function SitesMap({ sites, zoom }: { sites: SiteMarker[]; zoom?: number }) {
  return (
    <MapGate className="h-[50vh] min-h-72">
      <SitesMapInner sites={sites} zoom={zoom} />
    </MapGate>
  );
}

function SitesMapInner({ sites, zoom }: { sites: SiteMarker[]; zoom?: number }) {
  const t = useTranslations('sites');
  const maps = useTranslations('maps');
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !container.current || !sites.length) return;
      const lngs = sites.map((s) => s.lng);
      const lats = sites.map((s) => s.lat);
      const single = sites.length === 1;
      const instance = new maplibregl.Map({
        container: container.current,
        style: MAP_STYLE,
        ...(single
          ? { center: [sites[0]!.lng, sites[0]!.lat] as [number, number], zoom: zoom ?? 12 }
          : {
              bounds: [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              ] as [[number, number], [number, number]],
              fitBoundsOptions: { padding: 50, maxZoom: 11 },
            }),
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      instance.addControl(new maplibregl.NavigationControl(), 'top-right');
      addAirspaceControl(instance, { show: maps('airspace'), attribution: maps('airspaceCredit') });
      for (const site of sites) {
        const link = document.createElement('a');
        link.href = `/${locale}/sites/${site.slug}`;
        link.textContent = site.name;
        link.className = 'font-semibold text-brand-navy underline';
        new maplibregl.Marker({ color: '#de4750' })
          .setLngLat([site.lng, site.lat])
          .setPopup(new maplibregl.Popup({ offset: 24 }).setDOMContent(link))
          .addTo(instance);
      }
      map.current = instance;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels only matter on creation
  }, [sites, zoom, locale]);

  return (
    <div
      ref={container}
      className="h-[50vh] min-h-72 w-full overflow-hidden rounded-2xl border border-border"
      role="region"
      aria-label={t('mapLabel')}
    />
  );
}
