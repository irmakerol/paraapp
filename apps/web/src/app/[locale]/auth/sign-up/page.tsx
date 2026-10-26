import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { APP_CONFIG } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { publicEnv } from '@/lib/env';
import { Card, PageTitle, buttonClass } from '@/components/ui';
import { SignUpForm } from '../forms';
import { signInWithGoogle } from '../actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('signUpTitle', { app: APP_CONFIG.name }) };
}

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageTitle>{t('signUpTitle', { app: APP_CONFIG.name })}</PageTitle>
      <Card>
        <SignUpForm />
      </Card>
      {publicEnv.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED ? (
        <form action={signInWithGoogle}>
          <input type="hidden" name="locale" value={locale} />
          <button className={buttonClass('secondary', 'w-full')}>{t('google')}</button>
        </form>
      ) : null}
      <p className="text-center">
        {t('haveAccount')}{' '}
        <Link href="/auth/sign-in" className="font-semibold underline underline-offset-4">
          {t('signInSubmit')}
        </Link>
      </p>
    </div>
  );
}
