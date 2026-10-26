import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPush } from '@/lib/push';
import { formatDate } from '@/lib/format';

/** Pushes club news that is published, due, flagged for notification and not yet sent. */
export async function notifyDueNews(): Promise<number> {
  const admin = createAdminClient();
  const { data: due } = await admin
    .from('news')
    .select('id, slug, title, summary, members_only')
    .eq('status', 'published')
    .eq('notify_on_publish', true)
    .is('notified_at', null)
    .lte('published_at', new Date().toISOString());
  let sent = 0;
  for (const article of due ?? []) {
    // Claim it first so two runs never send the same article twice.
    const { data: claimed } = await admin
      .from('news')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', article.id)
      .is('notified_at', null)
      .select('id');
    if (!claimed?.length) continue;
    // Members-only articles are only announced to members.
    let recipients: string[] | 'everyone' = 'everyone';
    if (article.members_only) {
      const { data: members } = await admin
        .from('user_roles')
        .select('user_id')
        .in('role', ['member', 'instructor', 'moderator', 'safety_officer', 'admin']);
      recipients = [...new Set((members ?? []).map((m) => m.user_id))];
    }
    sent += await sendPush(recipients, 'news', (t, locale) => ({
      title: t('news'),
      body: article.title,
      url: `/${locale}/news/${article.slug}`,
      tag: `news-${article.id}`,
    }));
  }
  return sent;
}

/** Pushes in-app notifications (ad expiry, equipment checks) that have not been pushed yet. */
export async function pushPendingNotifications(): Promise<number> {
  const admin = createAdminClient();
  const { data: pending } = await admin
    .from('notifications')
    .select('id, user_id, kind, payload')
    .is('pushed_at', null)
    .gte('created_at', new Date(Date.now() - 2 * 86400_000).toISOString())
    .limit(500);
  if (!pending?.length) return 0;
  await admin
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .in(
      'id',
      pending.map((n) => n.id),
    );
  let sent = 0;
  for (const n of pending) {
    if (n.kind === 'ad_expiring') {
      const payload = (n.payload ?? {}) as { ad_id?: string; title?: string };
      sent += await sendPush([n.user_id], 'ads', (t, locale) => ({
        title: t('adExpiringTitle'),
        body: t('adExpiring', { title: payload.title ?? '' }),
        url: `/${locale}/market/mine`,
        tag: `ad-${payload.ad_id}`,
      }));
    } else if (n.kind === 'equipment_check_due' || n.kind === 'equipment_repack_due') {
      const payload = (n.payload ?? {}) as {
        equipment_id?: string;
        model?: string;
        due_on?: string;
      };
      const check = n.kind === 'equipment_check_due';
      sent += await sendPush([n.user_id], 'equipment', (t, locale) => ({
        title: t(check ? 'checkDueTitle' : 'repackDueTitle'),
        body: t('equipmentDue', {
          model: payload.model ?? '',
          date: payload.due_on ? formatDate(payload.due_on, locale) : '',
        }),
        url: `/${locale}/logbook/equipment`,
        tag: `${n.kind}-${payload.equipment_id}`,
      }));
    }
  }
  return sent;
}
