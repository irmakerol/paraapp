import * as FileSystem from 'expo-file-system/legacy';
import { CONFIG } from './config';
import { supabase } from './supabase';
import { listFlights, updateFlight, type LocalFlight } from './tracker/flights';

let running: Promise<void> | null = null;

/** Uploads every flight that isn't in the logbook yet, then applies "add to totals". */
export function uploadPending(): Promise<void> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token || !CONFIG.webUrl) return;
  for (const flight of await listFlights()) {
    if (!flight.remoteId) await uploadOne(flight, token);
  }
  const ready = (await listFlights()).filter((f) => f.remoteId && f.addToTotals && !f.totalsDone);
  if (ready.length) {
    const { error } = await supabase.rpc('add_flights_to_totals', {
      p_flights: ready.map((f) => f.remoteId),
    });
    if (!error) for (const f of ready) await updateFlight(f.id, { totalsDone: true });
  }
}

async function uploadOne(flight: LocalFlight, token: string) {
  try {
    const res = await FileSystem.uploadAsync(`${CONFIG.webUrl}/api/mobile/flights`, flight.igcUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'application/octet-stream',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.body) as { ok: boolean; id?: string; error?: string };
    if ((body.ok || body.error === 'duplicate') && body.id) {
      await updateFlight(flight.id, { remoteId: body.id, uploadError: null });
    } else {
      await updateFlight(flight.id, { uploadError: body.error ?? 'generic' });
    }
  } catch {
    await updateFlight(flight.id, { uploadError: 'offline' });
  }
}
