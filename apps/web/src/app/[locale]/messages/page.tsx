import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireActiveViewer } from '@/lib/session';
import { listChats } from '@/lib/chats';
import { formatDateTime } from '@/lib/format';
import { Card, PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('chat');
  const chats = await listChats(viewer.user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>{t('title')}</PageTitle>
      {chats.length === 0 ? (
        <Card>
          <p className="text-muted">{t('empty')}</p>
        </Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {chats.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-background"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-blue/20 font-bold"
                >
                  {(c.peerName ?? '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${c.unread ? 'font-bold' : 'font-medium'}`}>
                    {c.peerName ?? t('deletedUser')}
                    {c.muted ? (
                      <span className="ml-2 text-xs text-muted">· {t('muted')}</span>
                    ) : null}
                  </span>
                  {c.adTitle ? (
                    <span className="block truncate text-sm text-muted">
                      {t('about', { title: c.adTitle })}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {formatDateTime(c.lastMessageAt, locale)}
                </span>
                {c.unread ? (
                  <span className="size-2.5 shrink-0 rounded-full bg-brand-red" aria-label="•" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
