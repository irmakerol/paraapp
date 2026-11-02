/** 36.55231, 29.16190 → 36°33'08.3"N 29°09'42.8"E (same as toDms in packages/core). */
export function toDms(lat: number, lng: number): string {
  const part = (value: number, pos: string, neg: string) => {
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    return `${deg}°${String(min).padStart(2, '0')}'${sec.toFixed(1).padStart(4, '0')}"${value >= 0 ? pos : neg}`;
  };
  return `${part(lat, 'N', 'S')} ${part(lng, 'E', 'W')}`;
}

export function osmLink(lat: number, lng: number, zoom = 15): string {
  const la = lat.toFixed(5);
  const ln = lng.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${ln}#map=${zoom}/${la}/${ln}`;
}
