/**
 * Flyability from an Open-Meteo hourly forecast. A rough guide for planning, never a go/no-go:
 * the UI says so. Speeds are km/h.
 */

export const WEATHER_HOURLY = [
  'temperature_2m',
  'precipitation',
  'cloud_cover',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cape',
] as const;

export interface HourlyForecast {
  time: string[];
  temperature_2m: (number | null)[];
  precipitation: (number | null)[];
  cloud_cover: (number | null)[];
  wind_speed_10m: (number | null)[];
  wind_direction_10m: (number | null)[];
  wind_gusts_10m: (number | null)[];
  cape: (number | null)[];
}

export type Flyability = 'good' | 'marginal' | 'no';
export type FlyReason =
  'rain' | 'tooWindy' | 'gusty' | 'crossWind' | 'strongish' | 'overdevelopment' | 'noData';

export interface HourRating {
  time: string;
  rating: Flyability;
  reasons: FlyReason[];
  windKmh: number | null;
  gustKmh: number | null;
  directionDeg: number | null;
  temperature: number | null;
  precipitation: number | null;
}

export const LIMITS = {
  rainMm: 0.2,
  maxWind: 25,
  maxGust: 30,
  gustSpread: 15,
  marginalWind: 18,
  marginalGust: 25,
  calm: 8,
  overdevelopmentCape: 1500,
} as const;

const SECTOR_DEG: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

export function angleDiff(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/** True when the wind comes from one of the site's directions (±30°). Unknown sites: true. */
export function windFits(directionDeg: number, siteDirections: readonly string[]): boolean {
  if (!siteDirections.length) return true;
  return siteDirections.some((d) => {
    const sector = SECTOR_DEG[d];
    return sector !== undefined && angleDiff(directionDeg, sector) <= 30;
  });
}

export function rateHour(
  hour: Omit<HourRating, 'rating' | 'reasons'> & { cape: number | null },
  siteDirections: readonly string[],
): HourRating {
  const { cape, ...rest } = hour;
  const reasons: FlyReason[] = [];
  let rating: Flyability = 'good';
  const worse = (r: Flyability) => {
    if (r === 'no' || (r === 'marginal' && rating === 'good')) rating = r;
  };
  if (hour.windKmh === null || hour.directionDeg === null) {
    return { ...rest, rating: 'no', reasons: ['noData'] };
  }
  const gust = hour.gustKmh ?? hour.windKmh;
  if ((hour.precipitation ?? 0) > LIMITS.rainMm) {
    reasons.push('rain');
    worse('no');
  }
  if (hour.windKmh > LIMITS.maxWind || gust > LIMITS.maxGust) {
    reasons.push('tooWindy');
    worse('no');
  } else if (hour.windKmh > LIMITS.marginalWind || gust > LIMITS.marginalGust) {
    reasons.push('strongish');
    worse('marginal');
  }
  if (gust - hour.windKmh > LIMITS.gustSpread) {
    reasons.push('gusty');
    worse('no');
  }
  if (hour.windKmh > LIMITS.calm && !windFits(hour.directionDeg, siteDirections)) {
    reasons.push('crossWind');
    worse('no');
  }
  if ((cape ?? 0) > LIMITS.overdevelopmentCape) {
    reasons.push('overdevelopment');
    worse('marginal');
  }
  return { ...rest, rating, reasons };
}

/** Rates every hour of the forecast. */
export function rateForecast(
  hourly: HourlyForecast,
  siteDirections: readonly string[],
): HourRating[] {
  return hourly.time.map((time, i) =>
    rateHour(
      {
        time,
        windKmh: hourly.wind_speed_10m[i] ?? null,
        gustKmh: hourly.wind_gusts_10m[i] ?? null,
        directionDeg: hourly.wind_direction_10m[i] ?? null,
        temperature: hourly.temperature_2m[i] ?? null,
        precipitation: hourly.precipitation[i] ?? null,
        cape: hourly.cape[i] ?? null,
      },
      siteDirections,
    ),
  );
}

/** Per day (local date from the ISO time), the best rating during flying hours (09–18). */
export function dailySummary(
  hours: HourRating[],
): { date: string; rating: Flyability; goodHours: number }[] {
  const days = new Map<string, { rating: Flyability; goodHours: number }>();
  const rank: Record<Flyability, number> = { no: 0, marginal: 1, good: 2 };
  for (const h of hours) {
    const date = h.time.slice(0, 10);
    const hour = Number(h.time.slice(11, 13));
    if (hour < 9 || hour > 18) continue;
    const day = days.get(date) ?? { rating: 'no' as Flyability, goodHours: 0 };
    if (rank[h.rating] > rank[day.rating]) day.rating = h.rating;
    if (h.rating === 'good') day.goodHours++;
    days.set(date, day);
  }
  return [...days.entries()].map(([date, d]) => ({ date, ...d }));
}

export function openMeteoUrl(
  lat: number,
  lng: number,
  days = 3,
  base = 'https://api.open-meteo.com/v1/forecast',
): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    hourly: WEATHER_HOURLY.join(','),
    wind_speed_unit: 'kmh',
    timezone: 'Europe/Istanbul',
    forecast_days: String(days),
  });
  return `${base}?${params}`;
}
