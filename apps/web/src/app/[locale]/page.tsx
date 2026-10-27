import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { APP_CONFIG } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { getViewer } from '@/lib/session';
import { buttonClass } from '@/components/ui';

const features = ['trips', 'news', 'tips', 'market', 'logbook', 'sites', 'safety'] as const;
const featureHref: Record<(typeof features)[number], string> = {
  trips: '/trips',
  news: '/news',
  tips: '/tips',
  market: '/market',
  logbook: '/logbook',
  sites: '/sites',
  safety: '/safety',
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const viewer = await getViewer();

  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">{t('heroTitle')}</h1>
          <p className="max-w-2xl text-lg text-muted">
            {t('heroText', { club: APP_CONFIG.club.legalName })}
          </p>
          {viewer ? (
            <p className="text-lg font-semibold">
              {t('welcomeBack', { name: viewer.profile.display_name })}
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Link href="/auth/sign-up" className={buttonClass('primary')}>
                {t('ctaJoin')}
              </Link>
              <Link href="/auth/sign-in" className={buttonClass('secondary')}>
                {t('ctaSignIn')}
              </Link>
            </div>
          )}
        </div>
        <Image
          src="/brand/fly-anatolia-512.png"
          alt={APP_CONFIG.club.legalName}
          width={260}
          height={260}
          className="mx-auto"
          priority
        />
      </section>

      <section aria-labelledby="features" className="space-y-4">
        <h2 id="features" className="text-xl font-bold">
          {t('featuresTitle')}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <li key={f}>
              <Link
                href={featureHref[f]}
                className="block h-full rounded-2xl border border-border bg-card p-5 transition hover:shadow-md sm:p-6"
              >
                <h3 className="text-lg font-semibold">{t(`features.${f}.title`)}</h3>
                <p className="mt-1 text-muted">{t(`features.${f}.text`)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
