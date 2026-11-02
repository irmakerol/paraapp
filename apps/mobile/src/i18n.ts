import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MESSAGES, type Messages } from './messages';

export type Locale = 'tr' | 'en';
const LOCALE_KEY = 'settings:locale';

/**
 * The language chosen in the profile, else the phone language if Turkish or English, otherwise
 * Turkish (same rule as the website). `App` re-renders everything when it changes.
 */
export let locale: Locale = (() => {
  const code = getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : 'tr';
})();

const isLocale = (v: unknown): v is Locale => v === 'tr' || v === 'en';

/** Loads the language saved on this phone (call once at start-up). */
export async function loadSavedLocale(): Promise<Locale> {
  const saved = await AsyncStorage.getItem(LOCALE_KEY).catch(() => null);
  if (isLocale(saved)) locale = saved;
  return locale;
}

export function setLocale(next: string | null | undefined): boolean {
  if (!isLocale(next) || next === locale) return false;
  locale = next;
  void AsyncStorage.setItem(LOCALE_KEY, next).catch(() => undefined);
  return true;
}

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

function lookup(tree: unknown, key: string): string | undefined {
  let node: unknown = tree;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const text = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES.en, key) ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
