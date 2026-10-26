export type UnitSystem = 'metric' | 'imperial';
export type SpeedUnit = 'kmh' | 'ms' | 'mph' | 'kt';

export interface UnitPreferences {
  system: UnitSystem;
  speed: SpeedUnit;
}

export const DEFAULT_UNITS: UnitPreferences = { system: 'metric', speed: 'kmh' };

const SPEED_FACTORS: Record<SpeedUnit, number> = {
  ms: 1,
  kmh: 3.6,
  mph: 2.236936,
  kt: 1.943844,
};

/** Converts metres per second into the requested speed unit. */
export function convertSpeed(metresPerSecond: number, unit: SpeedUnit): number {
  return metresPerSecond * SPEED_FACTORS[unit];
}

export function convertAltitude(metres: number, system: UnitSystem): number {
  return system === 'metric' ? metres : metres * 3.28084;
}

export function convertDistance(metres: number, system: UnitSystem): number {
  return system === 'metric' ? metres / 1000 : metres / 1609.344;
}

export function speedUnitLabel(unit: SpeedUnit): string {
  return { ms: 'm/s', kmh: 'km/h', mph: 'mph', kt: 'kt' }[unit];
}

export function altitudeUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? 'm' : 'ft';
}

export function distanceUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? 'km' : 'mi';
}
