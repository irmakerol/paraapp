import { z } from 'zod';
import { slugify, tipSchema } from '@paraapp/core';
import { str } from '@/lib/form';

export function readTip(formData: FormData) {
  return tipSchema.safeParse({
    title: str(formData, 'title'),
    locale: str(formData, 'tip_locale'),
    summary: str(formData, 'summary'),
    body_md: str(formData, 'body_md'),
    category: str(formData, 'category'),
    difficulty: str(formData, 'difficulty'),
    video_url: str(formData, 'video_url'),
  });
}

export function tipFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    out[field] = field === 'video_url' ? 'tips.videoInvalid' : 'validation';
  }
  return out;
}

export function uniqueSlug(title: string): string {
  const suffix = crypto.randomUUID().slice(0, 6);
  return `${slugify(title) || 'tip'}-${suffix}`;
}
