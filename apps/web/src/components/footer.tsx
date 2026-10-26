import { getTranslations } from 'next-intl/server';
import { APP_CONFIG } from '@paraapp/core';
import { Link } from '@/i18n/navigation';

export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'footer' });
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t('rights', { year: new Date().getFullYear(), club: APP_CONFIG.club.legalName })}</p>
        <ul className="flex flex-wrap gap-4">
          <li>
            <Link href="/legal/privacy_notice" className="underline-offset-4 hover:underline">
              {t('privacyNotice')}
            </Link>
          </li>
          <li>
            <Link href="/legal/terms" className="underline-offset-4 hover:underline">
              {t('terms')}
            </Link>
          </li>
          <li>
            <Link href="/legal/explicit_consent" className="underline-offset-4 hover:underline">
              {t('explicitConsent')}
            </Link>
          </li>
          <li>
            <a
              href={`mailto:${APP_CONFIG.club.email}`}
              className="underline-offset-4 hover:underline"
            >
              {t('contact')}
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
