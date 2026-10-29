import { getLocales } from 'expo-localization';
import { MESSAGES, type Messages } from './messages';

export type Locale = 'tr' | 'en';

/** Phone language if Turkish or English, otherwise Turkish (same rule as the website). */
export const locale: Locale = (() => {
  const code = getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : 'tr';
})();

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
