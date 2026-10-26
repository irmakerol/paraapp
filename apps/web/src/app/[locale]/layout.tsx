import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { APP_CONFIG } from '@paraapp/core';
import { routing } from '@/i18n/routing';
import { publicEnv } from '@/lib/env';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Providers } from '@/components/providers';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: { default: t('title', { app: APP_CONFIG.name }), template: `%s · ${APP_CONFIG.name}` },
    description: t('description', { club: APP_CONFIG.club.legalName }),
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    openGraph: { siteName: APP_CONFIG.name, images: ['/brand/logo-512.png'], locale },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f6f2' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1a1e' },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <NextIntlClientProvider>
          <Providers>
            <Header locale={locale} />
            <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
              {children}
            </main>
            <Footer locale={locale} />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
