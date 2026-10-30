import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireActiveViewer } from '@/lib/session';
import { listChats } from '@/lib/chats';
import { listClubMessages } from '@/lib/club-messages';
import { formatDateTime } from '@/lib/format';
import { buttonClass, Card, PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('chat');
  const g = await getTranslations('groups');
  const club = await getTranslations('clubMessages');
  const [chats, clubMessages] = await Promise.all([
    listChats(viewer.user.id),
    listClubMessages(viewer.user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>{t('title')}</PageTitle>
      {clubMessages.length ? (
        <section className="mb-6 space-y-2" aria-labelledby="club-messages">
          <h2
            id="club-messages"
            className="text-sm font-semibold uppercase tracking-wide text-muted"
          >
            {club('title')}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {clubMessages.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/messages/club/${m.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-background"
                >
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-orange/20"
                  >
                    📣
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate ${m.unread ? 'font-bold' : 'font-medium'}`}
                  >
                    {m.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {formatDateTime(m.createdAt, locale)}
                  </span>
                  {m.unread ? (
                    <span className="size-2.5 shrink-0 rounded-full bg-primary">
                      <span className="sr-only">{club('unread')}</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {viewer.profile.age_group === 'adult' ? (
        <Link href="/messages/new-group" className={`${buttonClass('secondary')} mb-4`}>
          {g('new')}
        </Link>
      ) : null}
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
                  {c.groupTitle !== null ? '👥' : (c.peerName ?? '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${c.unread ? 'font-bold' : 'font-medium'}`}>
                    {c.groupTitle ?? c.peerName ?? t('deletedUser')}
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
