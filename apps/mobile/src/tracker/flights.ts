import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

/** A flight recorded on this phone. The IGC file is the source of truth; stats are for the list. */
export interface LocalFlight {
  id: string;
  startedAt: number;
  endedAt: number;
  durationS: number;
  maxAltM: number;
  distanceM: number;
  maxClimbMs: number;
  igcUri: string;
  /** Flight id in the logbook once uploaded. */
  remoteId: string | null;
  uploadError: string | null;
  /** The pilot's answer to "add to totals?" (null = not asked yet). */
  addToTotals: boolean | null;
  totalsDone: boolean;
}

const KEY = 'flights:v1';
export const FLIGHTS_DIR = `${FileSystem.documentDirectory ?? ''}flights/`;

type Listener = (flights: LocalFlight[]) => void;
const listeners = new Set<Listener>();
let cache: LocalFlight[] | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Serialises read-modify-write so the tracker task and the screens never overwrite each other. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

export async function listFlights(): Promise<LocalFlight[]> {
  if (cache) return cache;
  const raw = await AsyncStorage.getItem(KEY);
  cache = raw ? (JSON.parse(raw) as LocalFlight[]) : [];
  return cache;
}

async function write(flights: LocalFlight[]) {
  flights.sort((a, b) => b.startedAt - a.startedAt);
  cache = flights;
  await AsyncStorage.setItem(KEY, JSON.stringify(flights));
  for (const l of listeners) l(flights);
}

export function addFlight(flight: LocalFlight) {
  return locked(async () =>
    write([flight, ...(await listFlights()).filter((f) => f.id !== flight.id)]),
  );
}

export function updateFlight(id: string, patch: Partial<LocalFlight>) {
  return locked(async () =>
    write((await listFlights()).map((f) => (f.id === id ? { ...f, ...patch } : f))),
  );
}

export function removeFlight(id: string) {
  return locked(async () => {
    const flights = await listFlights();
    const flight = flights.find((f) => f.id === id);
    if (flight) await FileSystem.deleteAsync(flight.igcUri, { idempotent: true });
    await write(flights.filter((f) => f.id !== id));
  });
}

export function subscribeFlights(listener: Listener): () => void {
  listeners.add(listener);
  void listFlights().then(listener);
  return () => listeners.delete(listener);
}
