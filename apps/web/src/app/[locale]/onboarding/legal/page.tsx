import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireViewer } from '@/lib/session';
import { getLatestLegalDocument } from '@/lib/legal';
import { Link } from '@/i18n/navigation';
import { Markdown } from '@/components/markdown';
import { Card, PageTitle } from '@/components/ui';
import { LegalForm } from '../forms';

export default async function LegalOnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireViewer(locale);
  const t = await getTranslations('onboarding.legal');
  const [privacy, terms] = await Promise.all([
    getLatestLegalDocument('privacy_notice', locale),
    getLatestLegalDocument('terms', locale),
  ]);
  const ids = [privacy?.id, terms?.id].filter((id): id is string => Boolean(id));

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle lead={t('intro')}>{t('title')}</PageTitle>
      <Card>
        <LegalForm documentIds={ids}>
          {/* KVKK: the information notice is shown on its own, separately from any consent. */}
          <section aria-labelledby="privacy-heading" className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="privacy-heading" className="text-lg font-bold">
                {t('privacyHeading')}
              </h2>
              <Link href="/legal/privacy_notice" target="_blank" className="text-sm underline">
                {t('readFull')}
              </Link>
            </div>
            <div
              className="max-h-80 overflow-y-auto rounded-lg border border-border p-4"
              tabIndex={0}
            >
              {privacy ? <Markdown>{privacy.body_md}</Markdown> : null}
            </div>
          </section>
          <section aria-labelledby="terms-heading" className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="terms-heading" className="text-lg font-bold">
                {t('termsHeading')}
              </h2>
              <Link href="/legal/terms" target="_blank" className="text-sm underline">
                {t('readFull')}
              </Link>
            </div>
            <div
              className="max-h-80 overflow-y-auto rounded-lg border border-border p-4"
              tabIndex={0}
            >
              {terms ? <Markdown>{terms.body_md}</Markdown> : null}
            </div>
          </section>
        </LegalForm>
      </Card>
    </div>
  );
}
