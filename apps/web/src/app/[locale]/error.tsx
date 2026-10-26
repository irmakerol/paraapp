'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button, buttonClass, PageTitle } from '@/components/ui';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  useEffect(() => {
    // Only the digest is shown; the details stay in the server log.
    console.error(error);
  }, [error]);
  return (
    <div className="max-w-2xl space-y-6">
      <PageTitle lead={t('errorLead')}>{t('error')}</PageTitle>
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>{t('retry')}</Button>
        <Link href="/" className={buttonClass('secondary')}>
          {t('home')}
        </Link>
        <Link href="/sos" className={buttonClass('secondary')}>
          {t('sos')}
        </Link>
      </div>
      {error.digest ? (
        <p className="text-sm text-muted">{t('reference', { digest: error.digest })}</p>
      ) : null}
    </div>
  );
}
