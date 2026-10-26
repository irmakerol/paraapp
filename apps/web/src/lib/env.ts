import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // Web push. Empty = push turned off. Generate with `npx web-push generate-vapid-keys`.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().default(''),
});

// Next.js only inlines NEXT_PUBLIC_* values that are referenced literally.
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED || undefined,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LICENCE_ENCRYPTION_KEY: z.string().min(1),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(54325),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('ParaApp <no-reply@flyanatolia.com>'),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:info@flyanatolia.com'),
  // Shared secret for /api/cron/* (sent as "Authorization: Bearer <secret>").
  CRON_SECRET: z.string().optional(),
});

/** Server-only settings. Read lazily so pages that do not need them still render. */
export function serverEnv() {
  if (typeof window !== 'undefined') throw new Error('serverEnv() called in the browser');
  return serverSchema.parse(process.env);
}
