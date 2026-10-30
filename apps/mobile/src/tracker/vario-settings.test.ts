import { describe, expect, it } from 'vitest';
import {
  CLIMB_START_RANGE,
  DEFAULT_VARIO,
  SINK_ALARM_RANGE,
  parseVarioSettings,
  stepValue,
} from './vario-settings';

describe('vario settings', () => {
  it('steps without floating-point crumbs and stays in range', () => {
    expect(stepValue(0.2, 1, CLIMB_START_RANGE)).toBe(0.3);
    expect(stepValue(1, 1, CLIMB_START_RANGE)).toBe(1);
    expect(stepValue(0, -1, CLIMB_START_RANGE)).toBe(0);
    expect(stepValue(-2.5, -1, SINK_ALARM_RANGE)).toBe(-3);
    expect(stepValue(-1, 1, SINK_ALARM_RANGE)).toBe(-1);
  });

  it('falls back to defaults for missing or bad values', () => {
    expect(parseVarioSettings(null)).toEqual(DEFAULT_VARIO);
    expect(
      parseVarioSettings({ climbStart: 5, sinkAlarm: -3, volume: 'loud', sound: false }),
    ).toEqual({ ...DEFAULT_VARIO, sinkAlarm: -3, sound: false });
  });
});
