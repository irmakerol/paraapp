import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { APP_CONFIG } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { getViewer } from '@/lib/session';
import { activeFlightStart } from '@/lib/active-flight';
import { staffAreas } from '@/lib/staff';
import { signOut } from '@/app/[locale]/auth/actions';
import { LocaleSwitcher } from './locale-switcher';
import { MenuDetails } from './menu-details';
import { ThemeToggle } from './theme-toggle';
import { buttonClass } from './ui';

const navItems = [
  { href: '/news', key: 'news' },
  { href: '/tips', key: 'tips' },
  // The gear market is a prominent section of the notices page.
  { href: '/notices', key: 'notices' },
  { href: '/sites', key: 'sites' },
  { href: '/trips', key: 'trips' },
  { href: '/events', key: 'events' },
  { href: '/logbook', key: 'logbook' },
  { href: '/safety', key: 'safety' },
] as const;

export async function Header({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'nav' });
  const viewer = await getViewer();
  const flying = viewer ? Boolean(await activeFlightStart(viewer.user.id)) : false;

  const items: { href: string; key: string }[] = [...navItems];
  if (viewer) items.push({ href: '/messages', key: 'messages' });
  if (viewer && staffAreas(viewer).length) items.push({ href: '/admin', key: 'admin' });

  const links = items.map((item) => (
    <li key={item.href}>
      <Link
        href={item.href}
        className="block whitespace-nowrap rounded-lg px-3 py-2 font-medium hover:bg-background"
      >
        {t(item.key)}
      </Link>
    </li>
  ));

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-card focus:p-2"
      >
        {t('skipToContent')}
      </a>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 2xl:max-w-[96rem]">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image src="/brand/fly-anatolia-96.png" alt="" width={44} height={44} priority />
          <span className="hidden text-lg font-bold sm:inline">{APP_CONFIG.name}</span>
        </Link>

        <nav aria-label={t('menu')} className="ml-4 hidden 2xl:block">
          <ul className="flex gap-1">{links}</ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {viewer ? (
            <>
              {/* Flight recording is for phones and tablets; desktops only show logbook and replays. */}
              <Link
                href="/fly"
                className={`hidden min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-3 font-extrabold text-white pointer-coarse:inline-flex ${flying ? 'motion-safe:animate-pulse bg-sos' : 'bg-fly'}`}
              >
                {flying ? t('flying') : t('flyNow')}
              </Link>
              <Link
                href="/sos"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-sos px-3 font-extrabold text-white"
                aria-label={t('sosLabel')}
              >
                SOS
              </Link>
            </>
          ) : null}
          <div className="hidden items-center gap-2 sm:flex 2xl:hidden">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
          {viewer ? (
            <>
              <span className="hidden sm:block">
                <Link href="/account" className={buttonClass('secondary')}>
                  {viewer.profile.display_name}
                </Link>
              </span>
              <form action={signOut} className="hidden sm:block">
                <input type="hidden" name="locale" value={locale} />
                <button className={buttonClass('ghost')}>{t('signOut')}</button>
              </form>
            </>
          ) : (
            <>
              <span className="hidden sm:block">
                <Link href="/auth/sign-in" className={buttonClass('ghost')}>
                  {t('signIn')}
                </Link>
              </span>
              <Link href="/auth/sign-up" className={buttonClass('primary')}>
                {t('signUp')}
              </Link>
            </>
          )}

          <MenuDetails className="relative 2xl:hidden">
            <summary className={buttonClass('secondary', 'list-none cursor-pointer')}>
              {t('menu')}
            </summary>
            <div className="absolute right-0 mt-2 w-64 space-y-3 rounded-xl border border-border bg-card p-3 shadow-lg">
              <ul className="space-y-1">{links}</ul>
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <LocaleSwitcher />
                <ThemeToggle />
              </div>
              <div className="border-t border-border pt-3">
                {viewer ? (
                  <div className="space-y-2">
                    <Link href="/account" className={buttonClass('secondary', 'w-full')}>
                      {t('account')}
                    </Link>
                    <form action={signOut}>
                      <input type="hidden" name="locale" value={locale} />
                      <button className={buttonClass('ghost', 'w-full')}>{t('signOut')}</button>
                    </form>
                  </div>
                ) : (
                  <Link href="/auth/sign-in" className={buttonClass('secondary', 'w-full')}>
                    {t('signIn')}
                  </Link>
                )}
              </div>
            </div>
          </MenuDetails>
        </div>
      </div>
    </header>
  );
}
