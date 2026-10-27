import 'server-only';
import webpush from 'web-push';
import { getTranslations } from 'next-intl/server';
import { publicEnv, serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { routing } from '@/i18n/routing';

export type PushTopic = 'messages' | 'news' | 'ads' | 'equipment' | 'trips' | 'safety';

export interface PushPayload {
  title: string;
  body: string;
  /** Path inside the app, e.g. `/tr/messages/<id>`. */
  url: string;
  /** Notifications with the same tag replace each other on the device. */
  tag?: string;
}

type Translator = Awaited<ReturnType<typeof getTranslations<'push'>>>;
/** Builds the payload in each recipient's language. */
export type PayloadBuilder = (t: Translator, locale: string) => PushPayload;

let configured: boolean | null = null;
function configure(): boolean {
  if (configured !== null) return configured;
  const env = serverEnv();
  configured = Boolean(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  if (configured) {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT,
      publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY!,
    );
  }
  return configured;
}

export function pushEnabled(): boolean {
  return configure();
}

/**
 * Sends a push notification to users who turned the topic on. Club news also needs the
 * "marketing_notifications" consent. Dead subscriptions are removed. Never throws: a failed
 * push must not fail the action that triggered it.
 */
export async function sendPush(
  recipients: string[] | 'everyone',
  topic: PushTopic,
  build: PayloadBuilder,
): Promise<number> {
  if (!configure()) return 0;
  try {
    const admin = createAdminClient();
    let query = admin
      .from('profiles')
      .select('id, locale, notification_prefs')
      .eq('status', 'active');
    if (recipients !== 'everyone') {
      if (recipients.length === 0) return 0;
      query = query.in('id', recipients);
    }
    const { data: profiles } = await query;
    let wanted = (profiles ?? []).filter((p) => {
      const prefs = (p.notification_prefs ?? {}) as Record<string, unknown>;
      return prefs[topic] !== false;
    });
    if (topic === 'news' && wanted.length) {
      const { data: consents } = await admin
        .from('current_consents')
        .select('user_id, granted')
        .eq('consent_type', 'marketing_notifications')
        .in(
          'user_id',
          wanted.map((p) => p.id),
        );
      const ok = new Set((consents ?? []).filter((c) => c.granted).map((c) => c.user_id));
      wanted = wanted.filter((p) => ok.has(p.id));
    }
    if (!wanted.length) return 0;

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in(
        'user_id',
        wanted.map((p) => p.id),
      );
    if (!subs?.length) return 0;

    const payloads = new Map<string, string>();
    for (const locale of routing.locales) {
      const t = await getTranslations({ locale, namespace: 'push' });
      payloads.set(locale, JSON.stringify(build(t, locale)));
    }
    const localeOf = new Map(wanted.map((p) => [p.id, p.locale]));

    let sent = 0;
    const dead: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        const payload =
          payloads.get(localeOf.get(s.user_id) ?? routing.defaultLocale) ??
          payloads.get(routing.defaultLocale)!;
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 24 },
          );
          sent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) dead.push(s.id);
        }
      }),
    );
    if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead);
    return sent;
  } catch (error) {
    console.error('[push] failed', error);
    return 0;
  }
}
