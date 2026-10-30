/**
 * Vario settings the pilot can change on the vario settings page. Pure values and helpers here
 * (tested); loading and saving is in `vario-settings-store.ts`.
 */
export type VarioVolume = 'low' | 'medium' | 'high';
export type VarioDamping = 'fast' | 'normal' | 'smooth';

export interface VarioSettings {
  sound: boolean;
  keepAwake: boolean;
  /** Climb rate (m/s) where the beeps start. */
  climbStart: number;
  /** Sink rate (m/s, negative) where the low sink tone starts. */
  sinkAlarm: number;
  volume: VarioVolume;
  /** How much the barometer reading is smoothed: quicker reaction or a steadier number. */
  damping: VarioDamping;
}

export const DEFAULT_VARIO: VarioSettings = {
  sound: true,
  keepAwake: true,
  climbStart: 0.2,
  sinkAlarm: -2.5,
  volume: 'medium',
  damping: 'normal',
};

export const CLIMB_START_RANGE = { min: 0, max: 1, step: 0.1 } as const;
export const SINK_ALARM_RANGE = { min: -6, max: -1, step: 0.5 } as const;
export const VOLUMES: readonly VarioVolume[] = ['low', 'medium', 'high'];
export const DAMPINGS: readonly VarioDamping[] = ['fast', 'normal', 'smooth'];

export const VOLUME_LEVEL: Record<VarioVolume, number> = { low: 0.3, medium: 0.6, high: 0.95 };
/** Barometer averaging window in ms. */
export const DAMPING_WINDOW: Record<VarioDamping, number> = {
  fast: 1_000,
  normal: 2_000,
  smooth: 3_500,
};

/** Moves a value one step and keeps it in range, without floating-point crumbs (0.30000000004). */
export function stepValue(
  value: number,
  direction: 1 | -1,
  range: { min: number; max: number; step: number },
): number {
  const next = Math.round((value + direction * range.step) / range.step) * range.step;
  return Math.round(Math.min(range.max, Math.max(range.min, next)) * 10) / 10;
}

/** Settings read from storage: anything missing or out of range falls back to the default. */
export function parseVarioSettings(raw: unknown): VarioSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown, range: { min: number; max: number }, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= range.min && v <= range.max ? v : fallback;
  return {
    sound: typeof o.sound === 'boolean' ? o.sound : DEFAULT_VARIO.sound,
    keepAwake: typeof o.keepAwake === 'boolean' ? o.keepAwake : DEFAULT_VARIO.keepAwake,
    climbStart: num(o.climbStart, CLIMB_START_RANGE, DEFAULT_VARIO.climbStart),
    sinkAlarm: num(o.sinkAlarm, SINK_ALARM_RANGE, DEFAULT_VARIO.sinkAlarm),
    volume: VOLUMES.includes(o.volume as VarioVolume)
      ? (o.volume as VarioVolume)
      : DEFAULT_VARIO.volume,
    damping: DAMPINGS.includes(o.damping as VarioDamping)
      ? (o.damping as VarioDamping)
      : DEFAULT_VARIO.damping,
  };
}
