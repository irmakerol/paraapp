import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { APP_CONFIG, EMERGENCY_NUMBERS } from '@paraapp/core';
import { Card, PageTitle } from '@/components/ui';
import { MyPosition } from './my-position';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'sos' });
  return { title: t('title'), description: t('lead') };
}

/** Works without an account and sends nothing to our server: the position stays in the browser. */
export default async function SosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sos');
  const [first, ...others] = EMERGENCY_NUMBERS;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>
      <a
        href={`tel:${first.number}`}
        className="flex min-h-20 items-center justify-center gap-3 rounded-2xl bg-sos px-6 text-2xl font-bold text-white shadow-lg focus-visible:outline-4 focus-visible:outline-offset-2"
      >
        📞 {t('call', { number: first.number })}
      </a>
      <div className="grid gap-3 sm:grid-cols-2">
        {others.map((n) => (
          <a
            key={n.key}
            href={`tel:${n.number}`}
            className="flex min-h-14 items-center justify-between rounded-xl border-2 border-sos px-4 font-semibold"
          >
            <span>{t(`numbers.${n.key}`)}</span>
            <span className="text-xl">{n.number}</span>
          </a>
        ))}
      </div>
      <MyPosition />
      <Card className="space-y-2">
        <h2 className="text-lg font-bold">{t('tellTitle')}</h2>
        <ol className="list-decimal space-y-1 pl-5">
          {(['what', 'where', 'who', 'injuries', 'callback'] as const).map((k) => (
            <li key={k}>{t(`tell.${k}`)}</li>
          ))}
        </ol>
      </Card>
      <Card className="space-y-2">
        <h2 className="text-lg font-bold">{t('tipsTitle')}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {(['tree', 'water', 'wing', 'battery', 'helicopter'] as const).map((k) => (
            <li key={k}>{t(`tips.${k}`)}</li>
          ))}
        </ul>
      </Card>
      <p className="text-sm text-muted">
        {t('clubContact', { club: APP_CONFIG.club.shortName })}{' '}
        <a href={`mailto:${APP_CONFIG.club.email}`} className="underline">
          {APP_CONFIG.club.email}
        </a>
      </p>
      <p className="text-sm text-muted">{t('privacy')}</p>
    </div>
  );
}
