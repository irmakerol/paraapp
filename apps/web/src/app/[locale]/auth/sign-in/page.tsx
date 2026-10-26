import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { publicEnv } from '@/lib/env';
import { Alert, Card, PageTitle, buttonClass } from '@/components/ui';
import { MagicLinkForm, SignInForm } from '../forms';
import { signInWithGoogle } from '../actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('signInTitle'), robots: { index: false } };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  const errorKey = error === 'linkInvalid' ? 'linkInvalid' : error ? 'generic' : null;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageTitle>{t('signInTitle')}</PageTitle>
      {errorKey ? <Alert tone="error">{t(`errors.${errorKey}`)}</Alert> : null}
      <Card className="space-y-4">
        <SignInForm />
        <p className="text-sm">
          <Link href="/auth/forgot-password" className="underline underline-offset-4">
            {t('forgotLink')}
          </Link>
        </p>
      </Card>
      {publicEnv.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED ? (
        <form action={signInWithGoogle}>
          <input type="hidden" name="locale" value={locale} />
          <button className={buttonClass('secondary', 'w-full')}>{t('google')}</button>
        </form>
      ) : null}
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">{t('magicTitle')}</h2>
        <p className="text-sm text-muted">{t('magicText')}</p>
        <MagicLinkForm />
      </Card>
      <p className="text-center">
        {t('noAccount')}{' '}
        <Link href="/auth/sign-up" className="font-semibold underline underline-offset-4">
          {t('signUpSubmit')}
        </Link>
      </p>
    </div>
  );
}
