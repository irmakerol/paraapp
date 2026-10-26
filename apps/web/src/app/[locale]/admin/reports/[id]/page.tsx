import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { displayNames } from '@/lib/people';
import { formatDateTime } from '@/lib/format';
import { Alert, Button, buttonClass, Card, Textarea } from '@/components/ui';
import { moderate } from '../actions';

interface Target {
  title: string;
  body?: string | null;
  href?: string;
  offenderId: string | null;
  actions: ('hide_comment' | 'remove_ad' | 'unpublish_tip' | 'remove_ride')[];
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireStaff(locale, 'reports');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('admin.reportsAdmin');
  const common = await getTranslations('common');
  const chatT = await getTranslations('chat');
  const supabase = await createClient();
  const { data: report } = await supabase.from('reports').select('*').eq('id', id).maybeSingle();
  if (!report) notFound();

  // Load what was reported and who is responsible for it.
  let target: Target = { title: '—', offenderId: null, actions: [] };
  switch (report.target_type) {
    case 'ad': {
      const { data } = await supabase
        .from('ads')
        .select('id, title, description, owner_id, removed_at')
        .eq('id', report.target_id)
        .maybeSingle();
      if (data)
        target = {
          title: data.title,
          body: data.description,
          href: `/market/${data.id}`,
          offenderId: data.owner_id,
          actions: data.removed_at ? [] : ['remove_ad'],
        };
      break;
    }
    case 'news_comment': {
      const { data } = await supabase
        .from('news_comments')
        .select('id, body, author_id, hidden_at')
        .eq('id', report.target_id)
        .maybeSingle();
      if (data)
        target = {
          title: t('targets.news_comment'),
          body: data.body,
          offenderId: data.author_id,
          actions: data.hidden_at ? [] : ['hide_comment'],
        };
      break;
    }
    case 'tip': {
      const { data } = await supabase
        .from('tips')
        .select('id, slug, title, summary, author_id, status')
        .eq('id', report.target_id)
        .maybeSingle();
      if (data)
        target = {
          title: data.title,
          body: data.summary,
          href: `/tips/${data.slug}`,
          offenderId: data.author_id,
          actions: data.status === 'published' ? ['unpublish_tip'] : [],
        };
      break;
    }
    case 'ride': {
      const { data } = await supabase
        .from('rides')
        .select('id, from_text, to_text, note, user_id')
        .eq('id', report.target_id)
        .maybeSingle();
      if (data)
        target = {
          title: [data.from_text, data.to_text].filter(Boolean).join(' → '),
          body: data.note,
          href: '/rides',
          offenderId: data.user_id,
          actions: ['remove_ride'],
        };
      break;
    }
    case 'event': {
      const { data } = await supabase
        .from('events')
        .select('slug, title, description_md, created_by')
        .eq('id', report.target_id)
        .maybeSingle();
      if (data)
        target = {
          title: data.title,
          body: data.description_md,
          href: `/events/${data.slug}`,
          offenderId: data.created_by,
          actions: [],
        };
      break;
    }
    case 'user':
      target = { title: t('targets.user'), offenderId: report.target_id, actions: [] };
      break;
    case 'chat':
    case 'message':
      target = { title: t(`targets.${report.target_type}`), offenderId: null, actions: [] };
      break;
  }

  // Reported conversations are only opened on request; each opening is audited.
  const viewChat =
    (report.target_type === 'chat' || report.target_type === 'message') &&
    (await searchParams).view === '1';
  const { data: chatMessages } = viewChat
    ? await supabase.rpc('reported_chat_messages', { p_report: report.id })
    : { data: null };
  if (chatMessages?.length && !target.offenderId) {
    // The person reported is whoever in the chat is not the reporter.
    target.offenderId =
      (report.target_type === 'message'
        ? chatMessages.find((m) => m.id === report.target_id)?.sender_id
        : chatMessages.find((m) => m.sender_id && m.sender_id !== report.reporter_id)?.sender_id) ??
      null;
  }
  const names = await displayNames(supabase, [
    report.reporter_id,
    target.offenderId,
    ...(chatMessages ?? []).map((m) => m.sender_id),
  ]);
  const canBan = target.offenderId && target.offenderId !== viewer.user.id;

  const actionButton = (
    action: string,
    label: string,
    variant: 'secondary' | 'danger' = 'secondary',
  ) => (
    <Button name="action" value={action} variant={variant}>
      {label}
    </Button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/reports" className="text-sm text-muted hover:underline">
        ← {t('open')}
      </Link>
      <Card className="space-y-2">
        <p className="text-sm text-muted">
          {t(`targets.${report.target_type}`)} · {common(`reasons.${report.reason}`)} ·{' '}
          {formatDateTime(report.created_at, locale)}
        </p>
        <p>
          {t('reporter')}: {(report.reporter_id && names.get(report.reporter_id)) || '—'}
        </p>
        {report.details ? <p className="whitespace-pre-line">{report.details}</p> : null}
        {report.status !== 'open' ? (
          <Alert>
            {t(`statuses.${report.status}`)}
            {report.resolution_note ? `: ${report.resolution_note}` : ''}
          </Alert>
        ) : null}
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-bold">{target.title}</h2>
        {target.body ? <p className="whitespace-pre-line">{target.body}</p> : null}
        {target.href ? (
          <Link href={target.href} className="underline">
            {target.href}
          </Link>
        ) : null}
        {target.offenderId ? (
          <p className="text-sm text-muted">
            → {names.get(target.offenderId) ?? target.offenderId}
          </p>
        ) : null}
        {(report.target_type === 'chat' || report.target_type === 'message') && !viewChat ? (
          <div className="space-y-2 pt-2">
            <p className="text-sm text-muted">{t('chatAudit')}</p>
            <Link
              href={{ pathname: `/admin/reports/${report.id}`, query: { view: '1' } }}
              className={buttonClass('secondary')}
            >
              {t('viewChat')}
            </Link>
          </div>
        ) : null}
        {chatMessages ? (
          <ol className="max-h-96 space-y-2 overflow-y-auto rounded-xl border border-border p-3 text-sm">
            {chatMessages.map((m) => (
              <li
                key={m.id}
                className={m.id === report.target_id ? 'rounded bg-brand-yellow/30 p-1' : undefined}
              >
                <span className="font-semibold">
                  {(m.sender_id && names.get(m.sender_id)) || '—'}
                </span>{' '}
                <span className="text-muted">{formatDateTime(m.created_at, locale)}</span>
                {m.deleted_at ? <span className="text-muted"> · {chatT('deleted')}</span> : null}
                <p className="whitespace-pre-wrap">
                  {m.body ??
                    (m.image_path
                      ? `[${chatT('image')}]`
                      : m.lat
                        ? `[${chatT('locationLabel')}]`
                        : '')}
                </p>
              </li>
            ))}
          </ol>
        ) : null}
      </Card>

      {report.status === 'open' ? (
        <Card>
          <form action={moderate} className="space-y-4">
            <input type="hidden" name="report_id" value={report.id} />
            <input type="hidden" name="target_id" value={report.target_id} />
            <input type="hidden" name="offender_id" value={target.offenderId ?? ''} />
            <label htmlFor="note" className="block text-sm font-semibold">
              {t('note')}
            </label>
            <Textarea id="note" name="note" rows={2} maxLength={1000} />
            <p className="text-sm font-semibold">{t('actions')}</p>
            <div className="flex flex-wrap gap-2">
              {actionButton('dismiss', t('dismiss'))}
              {target.actions.includes('hide_comment')
                ? actionButton('hide_comment', t('hideComment'))
                : null}
              {target.actions.includes('remove_ad')
                ? actionButton('remove_ad', t('removeAd'))
                : null}
              {target.actions.includes('remove_ride')
                ? actionButton('remove_ride', t('removeRide'))
                : null}
              {target.actions.includes('unpublish_tip')
                ? actionButton('unpublish_tip', t('unpublishTip'))
                : null}
              {canBan ? (
                <>
                  {actionButton('ban7', t('ban7'), 'danger')}
                  {actionButton('ban30', t('ban30'), 'danger')}
                  {actionButton('ban_forever', t('banForever'), 'danger')}
                </>
              ) : null}
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
