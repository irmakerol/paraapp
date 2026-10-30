import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_VARIO, parseVarioSettings, type VarioSettings } from './vario-settings';

const KEY = 'settings:vario:v1';
// Build 39 and earlier stored these two on their own.
const OLD_SOUND = 'settings:sound';
const OLD_AWAKE = 'settings:awake';

let current: VarioSettings = DEFAULT_VARIO;
let loaded: Promise<void> | null = null;
const listeners = new Set<(s: VarioSettings) => void>();

function load(): Promise<void> {
  loaded ??= AsyncStorage.multiGet([KEY, OLD_SOUND, OLD_AWAKE])
    .then(([saved, sound, awake]) => {
      if (saved?.[1]) {
        current = parseVarioSettings(JSON.parse(saved[1]));
      } else {
        current = {
          ...DEFAULT_VARIO,
          ...(sound?.[1] ? { sound: sound[1] === '1' } : {}),
          ...(awake?.[1] ? { keepAwake: awake[1] === '1' } : {}),
        };
      }
      for (const l of listeners) l(current);
    })
    .catch(() => undefined);
  return loaded;
}

export async function saveVarioSettings(patch: Partial<VarioSettings>) {
  await load();
  current = { ...current, ...patch };
  for (const l of listeners) l(current);
  await AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => undefined);
}

/** The current vario settings; re-renders when they change anywhere in the app. */
export function useVarioSettings(): VarioSettings {
  const [settings, setSettings] = useState(current);
  useEffect(() => {
    listeners.add(setSettings);
    void load().then(() => setSettings(current));
    return () => {
      listeners.delete(setSettings);
    };
  }, []);
  return settings;
}
