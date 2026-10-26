import type { Map as MapLibreMap } from 'maplibre-gl';
import { publicEnv } from '@/lib/env';

/** Free vector tiles, no API key, no tracking. © OpenStreetMap contributors. */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const MAP_CONSENT_KEY = 'paraapp.maps';

/** OpenAIP raster tiles (airspace, obstacles, airports). Needs a free key; off without one. */
const OPENAIP_TILES = ['a', 'b', 'c'].map(
  (s) => `https://${s}.api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=`,
);

export function airspaceAvailable(): boolean {
  return publicEnv.NEXT_PUBLIC_OPENAIP_API_KEY !== '';
}

/**
 * Adds a hidden airspace layer and a map button that shows/hides it. Tiles are only requested
 * once the user turns the layer on.
 */
export function addAirspaceControl(
  map: MapLibreMap,
  labels: { show: string; attribution: string },
) {
  if (!airspaceAvailable()) return;
  const key = encodeURIComponent(publicEnv.NEXT_PUBLIC_OPENAIP_API_KEY);
  let added = false;
  let visible = false;
  const container = document.createElement('div');
  container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '✈';
  button.title = labels.show;
  button.setAttribute('aria-label', labels.show);
  button.setAttribute('aria-pressed', 'false');
  button.style.fontSize = '16px';
  container.appendChild(button);
  button.addEventListener('click', () => {
    if (!added) {
      map.addSource('openaip', {
        type: 'raster',
        tiles: OPENAIP_TILES.map((u) => u + key),
        tileSize: 256,
        maxzoom: 14,
        attribution: labels.attribution,
      });
      map.addLayer({
        id: 'openaip',
        type: 'raster',
        source: 'openaip',
        paint: { 'raster-opacity': 0.8 },
      });
      added = true;
    }
    visible = !visible;
    map.setLayoutProperty('openaip', 'visibility', visible ? 'visible' : 'none');
    button.setAttribute('aria-pressed', String(visible));
  });
  map.addControl({ onAdd: () => container, onRemove: () => container.remove() }, 'top-right');
}
