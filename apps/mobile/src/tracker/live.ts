import { distance } from '@paraapp/core-tracks';

/** One GPS fix from the phone. `t` epoch ms, `alt` metres above sea level, `speed` m/s or null. */
export interface Fix {
  t: number;
  lat: number;
  lng: number;
  alt: number;
  speed: number | null;
  acc: number | null;
}

export type Phase = 'waiting' | 'flying' | 'landed';

export interface LiveState {
  phase: Phase;
  takeoffAt: number | null;
  landedAt: number | null;
  takeoffAlt: number | null;
  last: Fix | null;
  groundSpeed: number | null;
  /** Climb rate from GPS altitude (the barometer is better while the screen is on). */
  gpsVario: number | null;
  /** Distance flown per metre lost over the last 20 s; null while not sinking. */
  glide: number | null;
}

/** Ground speed that counts as flying (≈ 14 km/h), and for how long. */
export const TAKEOFF_SPEED = 4;
export const TAKEOFF_SECONDS = 8;
/** A climb or drop this big from the start position also counts as a takeoff (strong wind). */
export const TAKEOFF_ALT_CHANGE = 50;
/**
 * On the ground: slower than this, with the altitude steady, for LANDED_SECONDS. A glider
 * hovering in strong wind can have no ground speed, but it doesn't hold its altitude within
 * a few metres for minutes, so the recorder doesn't stop in the air.
 */
export const LANDED_SPEED = 1.2;
export const LANDED_ALT_RANGE = 6;
export const LANDED_SECONDS = 300;

/** Takeoff/landing detection and live numbers from a stream of fixes. */
export class FlightDetector {
  private fixes: Fix[] = [];
  private fastSince: number | null = null;
  private stillSince: number | null = null;
  private stillMin = Infinity;
  private stillMax = -Infinity;
  private first: Fix | null = null;
  state: LiveState = {
    phase: 'waiting',
    takeoffAt: null,
    landedAt: null,
    takeoffAlt: null,
    last: null,
    groundSpeed: null,
    gpsVario: null,
    glide: null,
  };

  push(fix: Fix): LiveState {
    const prev = this.fixes[this.fixes.length - 1];
    if (prev && fix.t <= prev.t) return this.state;
    this.first ??= fix;
    // Keep a minute of history for the live numbers.
    this.fixes.push(fix);
    while (this.fixes.length > 2 && (this.fixes[0]?.t ?? 0) < fix.t - 60_000) this.fixes.shift();

    const speed = this.speedOf(fix, prev);
    const s = this.state;
    s.last = fix;
    s.groundSpeed = speed;
    s.gpsVario = this.climb(fix, 5_000);
    s.glide = this.glideRatio(fix, 20_000);

    if (s.phase === 'waiting') {
      const fast = speed !== null && speed >= TAKEOFF_SPEED;
      this.fastSince = fast ? (this.fastSince ?? fix.t) : null;
      const moved = this.first && Math.abs(fix.alt - this.first.alt) >= TAKEOFF_ALT_CHANGE;
      if ((this.fastSince !== null && fix.t - this.fastSince >= TAKEOFF_SECONDS * 1000) || moved) {
        s.phase = 'flying';
        s.takeoffAt = this.fastSince ?? fix.t;
        s.takeoffAlt = this.altAt(s.takeoffAt) ?? fix.alt;
        this.fastSince = null;
      }
    } else if (s.phase === 'flying') {
      const slow = speed !== null && speed < LANDED_SPEED;
      if (slow) {
        if (this.stillSince === null) {
          this.stillSince = fix.t;
          this.stillMin = fix.alt;
          this.stillMax = fix.alt;
        }
        this.stillMin = Math.min(this.stillMin, fix.alt);
        this.stillMax = Math.max(this.stillMax, fix.alt);
        if (this.stillMax - this.stillMin > LANDED_ALT_RANGE) {
          // Moving up or down: still flying. Start a new still period from here.
          this.stillSince = fix.t;
          this.stillMin = fix.alt;
          this.stillMax = fix.alt;
        } else if (fix.t - this.stillSince >= LANDED_SECONDS * 1000) {
          s.phase = 'landed';
          s.landedAt = this.stillSince;
        }
      } else {
        this.stillSince = null;
      }
    }
    return s;
  }

  private speedOf(fix: Fix, prev: Fix | undefined): number | null {
    if (fix.speed !== null && fix.speed >= 0) return fix.speed;
    if (!prev) return null;
    const dt = (fix.t - prev.t) / 1000;
    return dt > 0 ? distance(prev, fix) / dt : null;
  }

  private fixAtOrBefore(t: number): Fix | undefined {
    let found: Fix | undefined;
    for (const f of this.fixes) {
      if (f.t <= t) found = f;
      else break;
    }
    return found;
  }

  private altAt(t: number): number | null {
    return this.fixAtOrBefore(t)?.alt ?? null;
  }

  private climb(fix: Fix, windowMs: number): number | null {
    const from = this.fixAtOrBefore(fix.t - windowMs) ?? this.fixes[0];
    if (!from || from === fix) return null;
    const dt = (fix.t - from.t) / 1000;
    return dt >= 2 ? (fix.alt - from.alt) / dt : null;
  }

  private glideRatio(fix: Fix, windowMs: number): number | null {
    const from = this.fixAtOrBefore(fix.t - windowMs);
    if (!from) return null;
    const lost = from.alt - fix.alt;
    if (lost < 2) return null;
    let flown = 0;
    let p = from;
    for (const f of this.fixes) {
      if (f.t <= from.t) continue;
      flown += distance(p, f);
      p = f;
    }
    return flown / lost;
  }
}

/** Climb rate from the barometer's relative altitude: least-squares slope over ~2 s. */
export class BaroVario {
  private samples: { t: number; h: number }[] = [];

  push(t: number, h: number): number | null {
    this.samples.push({ t, h });
    while (this.samples.length > 2 && (this.samples[0]?.t ?? 0) < t - 2_000) this.samples.shift();
    const n = this.samples.length;
    if (n < 4) return null;
    const t0 = this.samples[0]?.t ?? t;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const s of this.samples) {
      const x = (s.t - t0) / 1000;
      sx += x;
      sy += s.h;
      sxx += x * x;
      sxy += x * s.h;
    }
    const den = n * sxx - sx * sx;
    return den > 0 ? (n * sxy - sx * sy) / den : null;
  }

  reset() {
    this.samples = [];
  }
}
