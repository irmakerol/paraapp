import { getTranslations } from 'next-intl/server';
import { APP_CONFIG } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'footer' });
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t('rights', { year: new Date().getFullYear(), club: APP_CONFIG.club.legalName })}</p>
        <ul className="flex flex-wrap gap-x-4">
          <li>
            <Link
              href="/legal/privacy_notice"
              className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              {t('privacyNotice')}
            </Link>
          </li>
          <li>
            <Link
              href="/legal/terms"
              className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              {t('terms')}
            </Link>
          </li>
          <li>
            <Link
              href="/legal/explicit_consent"
              className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              {t('explicitConsent')}
            </Link>
          </li>
          <li>
            <a
              href={`mailto:${APP_CONFIG.club.email}`}
              className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              {t('contact')}
            </a>
          </li>
        </ul>
        {/* On wide screens the header has no room for these; on small screens they are in the menu. */}
        <div className="hidden gap-2 2xl:flex">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
