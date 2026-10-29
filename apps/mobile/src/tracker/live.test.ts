import { describe, expect, it } from 'vitest';
import { FlightDetector, LANDED_SECONDS, type Fix } from './live';

// About 1 m of latitude in degrees.
const M = 1 / 111_320;

function fix(t: number, north: number, alt: number, speed: number): Fix {
  return { t: t * 1000, lat: 36.55 + north * M, lng: 29.12, alt, speed, acc: 5 };
}

describe('FlightDetector', () => {
  it('waits on the ground, detects takeoff, then landing after the still period', () => {
    const d = new FlightDetector();
    let t = 0;
    let north = 0;
    for (; t < 60; t++) d.push(fix(t, north, 1900, 0.3));
    expect(d.state.phase).toBe('waiting');

    // Launch: 9 m/s for a minute, sinking 1 m/s.
    for (let i = 0; i < 60; i++, t++) {
      north += 9;
      d.push(fix(t, north, 1900 - i, 9));
    }
    expect(d.state.phase).toBe('flying');
    expect(d.state.takeoffAt).toBe(60_000);
    expect(d.state.takeoffAlt).toBe(1900);
    expect(d.state.glide).toBeCloseTo(9, 0);

    // Landed and standing still.
    for (let i = 0; i <= LANDED_SECONDS + 1; i++, t++) d.push(fix(t, north, 1200, 0));
    expect(d.state.phase).toBe('landed');
    expect(d.state.landedAt).toBe(120_000);
  });

  it('does not land while hovering in strong wind with the altitude changing', () => {
    const d = new FlightDetector();
    let t = 0;
    for (let i = 0; i < 20; i++, t++) d.push(fix(t, i * 8, 1000, 8));
    expect(d.state.phase).toBe('flying');
    // Ten minutes of zero ground speed while the glider goes up and down in the lift band.
    for (let i = 0; i < 600; i++, t++) d.push(fix(t, 160, 1000 + 15 * Math.sin(i / 20), 0.2));
    expect(d.state.phase).toBe('flying');
  });

  it('counts a big height change as takeoff even with no ground speed', () => {
    const d = new FlightDetector();
    for (let t = 0; t < 40; t++) d.push(fix(t, 0, 1000 + t * 2, 0.5));
    expect(d.state.phase).toBe('flying');
    expect(d.state.gpsVario).toBeCloseTo(2, 1);
  });

  it('ignores fixes that go back in time', () => {
    const d = new FlightDetector();
    d.push(fix(10, 0, 1000, 0));
    d.push(fix(5, 0, 2000, 0));
    expect(d.state.last?.alt).toBe(1000);
  });
});
