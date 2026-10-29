import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { analyseTrack, toIgc, type TrackPoint } from '@paraapp/core-tracks';
import { FLIGHTS_DIR, addFlight, type LocalFlight } from './flights';
import { FlightDetector, type Fix, type LiveState } from './live';

export const LOCATION_TASK = 'flight-recorder';

const ACTIVE_KEY = 'recording:v1';
/** The signed-in pilot's name, written into the IGC header. */
export const PILOT_NAME_KEY = 'pilot:name';
const REC_DIR = `${FileSystem.documentDirectory ?? ''}recording/`;
/** Fixes are written to disk in small chunks so a crash or iOS ending the app loses seconds at most. */
const CHUNK_EVERY = 10;

interface Active {
  id: string;
  startedAt: number;
  chunks: number;
}

export type RecorderEvent =
  | { type: 'state'; recording: boolean; live: LiveState | null }
  | { type: 'saved'; flight: LocalFlight }
  | { type: 'discarded' };

type Listener = (event: RecorderEvent) => void;
const listeners = new Set<Listener>();

let active: Active | null = null;
let fixes: Fix[] = [];
let pending: Fix[] = [];
let detector = new FlightDetector();
let loaded = false;
let queue: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

function emit(event: RecorderEvent) {
  for (const l of listeners) l(event);
}

function emitState() {
  emit({ type: 'state', recording: active !== null, live: active ? detector.state : null });
}

export function subscribeRecorder(listener: Listener): () => void {
  listeners.add(listener);
  void ensureLoaded().then(() =>
    listener({ type: 'state', recording: active !== null, live: active ? detector.state : null }),
  );
  return () => listeners.delete(listener);
}

/** After iOS relaunches the app for a location update, pick the recording up from disk. */
async function ensureLoaded() {
  if (loaded) return;
  await locked(async () => {
    if (loaded) return;
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    active = raw ? (JSON.parse(raw) as Active) : null;
    fixes = [];
    detector = new FlightDetector();
    if (active) {
      for (let i = 0; i < active.chunks; i++) {
        const text = await FileSystem.readAsStringAsync(`${REC_DIR}${i}.json`).catch(() => '[]');
        for (const fix of JSON.parse(text) as Fix[]) {
          fixes.push(fix);
          detector.push(fix);
        }
      }
    }
    loaded = true;
  });
}

async function flush() {
  if (!active || pending.length === 0) return;
  const chunk = pending;
  pending = [];
  await FileSystem.writeAsStringAsync(`${REC_DIR}${active.chunks}.json`, JSON.stringify(chunk));
  active.chunks += 1;
  await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
}

export async function isRecording(): Promise<boolean> {
  await ensureLoaded();
  return active !== null;
}

export type StartResult = 'started' | 'denied' | 'foregroundOnly';

export async function startRecording(): Promise<StartResult> {
  await ensureLoaded();
  if (active) return 'started';
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);

  await locked(async () => {
    await FileSystem.deleteAsync(REC_DIR, { idempotent: true });
    await FileSystem.makeDirectoryAsync(REC_DIR, { intermediates: true });
    active = { id: Crypto.randomUUID(), startedAt: Date.now(), chunks: 0 };
    fixes = [];
    pending = [];
    detector = new FlightDetector();
    await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
  });
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 0,
    activityType: Location.ActivityType.Airborne,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
  emitState();
  return bg?.status === 'granted' ? 'started' : 'foregroundOnly';
}

/** Called by the background task with each batch of locations. */
export async function onLocations(locations: Location.LocationObject[]) {
  await ensureLoaded();
  let landed = false;
  await locked(async () => {
    if (!active) return;
    for (const loc of locations) {
      const c = loc.coords;
      const fix: Fix = {
        t: loc.timestamp,
        lat: c.latitude,
        lng: c.longitude,
        alt: c.altitude ?? 0,
        speed: c.speed ?? null,
        acc: c.accuracy ?? null,
      };
      const last = fixes[fixes.length - 1];
      if (last && fix.t <= last.t) continue;
      // Skip fixes that are far too inaccurate to be part of a track.
      if (fix.acc !== null && fix.acc > 100) continue;
      fixes.push(fix);
      pending.push(fix);
      if (detector.push(fix).phase === 'landed') landed = true;
    }
    if (pending.length >= CHUNK_EVERY) await flush();
  });
  emitState();
  if (landed) await stopRecording();
}

/** Stops GPS, writes the IGC file and adds the flight to the list. */
export async function stopRecording(): Promise<LocalFlight | null> {
  await ensureLoaded();
  const pilot = (await AsyncStorage.getItem(PILOT_NAME_KEY)) ?? undefined;
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined);
  }
  const result = await locked(async () => {
    if (!active) return null;
    await flush();
    const id = active.id;
    const points: TrackPoint[] = fixes.map((f) => ({ t: f.t, lat: f.lat, lng: f.lng, alt: f.alt }));
    active = null;
    fixes = [];
    detector = new FlightDetector();
    await AsyncStorage.removeItem(ACTIVE_KEY);

    const first = points[0];
    const last = points[points.length - 1];
    if (points.length < 10 || !first || !last) {
      await FileSystem.deleteAsync(REC_DIR, { idempotent: true });
      return null;
    }
    await FileSystem.makeDirectoryAsync(FLIGHTS_DIR, { intermediates: true }).catch(
      () => undefined,
    );
    const igcUri = `${FLIGHTS_DIR}${id}.igc`;
    await FileSystem.writeAsStringAsync(igcUri, toIgc(points, { pilot }));
    await FileSystem.deleteAsync(REC_DIR, { idempotent: true });

    const stats = analyseTrack(points)?.stats;
    const flight: LocalFlight = {
      id,
      startedAt: stats?.startedAt ?? first.t,
      endedAt: stats?.endedAt ?? last.t,
      durationS: stats?.durationS ?? Math.round((last.t - first.t) / 1000),
      maxAltM: stats?.maxAltM ?? Math.round(Math.max(...points.map((p) => p.alt))),
      distanceM: stats?.distanceM ?? 0,
      maxClimbMs: stats?.maxClimbMs ?? 0,
      igcUri,
      remoteId: null,
      uploadError: null,
      addToTotals: null,
      totalsDone: false,
    };
    await addFlight(flight);
    return flight;
  });
  emitState();
  emit(result ? { type: 'saved', flight: result } : { type: 'discarded' });
  return result;
}
