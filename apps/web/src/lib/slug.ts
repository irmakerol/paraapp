import { slugify } from '@paraapp/core';

/** A readable slug with a short random suffix, so titles never collide. */
export function slugWithSuffix(title: string, fallback: string): string {
  return `${slugify(title) || fallback}-${crypto.randomUUID().slice(0, 6)}`;
}
