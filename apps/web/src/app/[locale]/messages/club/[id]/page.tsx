import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireActiveViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/format';
import { Card } from '@/components/ui';
import { MarkRead } from './mark-read';

export const dynamic = 'force-dynamic';

export default async function ClubMessagePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('clubMessages');
  const supabase = await createClient();
  const [{ data: message }, { data: receipt }] = await Promise.all([
    supabase.from('club_messages').select('id, title, body, created_at').eq('id', id).maybeSingle(),
    supabase
      .from('club_message_recipients')
      .select('read_at')
      .eq('message_id', id)
      .eq('user_id', viewer.user.id)
      .maybeSingle(),
  ]);
  if (!message) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/messages" className="text-sm underline">
        ← {t('back')}
      </Link>
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-muted">
          {t('from')} · {formatDateTime(message.created_at, locale)}
        </p>
        <h1 className="text-2xl font-bold">{message.title}</h1>
        <p className="whitespace-pre-line">{message.body}</p>
      </Card>
      {receipt && !receipt.read_at ? <MarkRead id={message.id} /> : null}
    </div>
  );
}
