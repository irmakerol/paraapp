import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { buttonClass, PageTitle } from '@/components/ui';

export default function NotFound() {
  const t = useTranslations('errors');
  return (
    <div className="max-w-2xl space-y-6">
      <PageTitle lead={t('notFoundLead')}>{t('notFound')}</PageTitle>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className={buttonClass('primary')}>
          {t('home')}
        </Link>
        <Link href="/sos" className={buttonClass('secondary')}>
          {t('sos')}
        </Link>
      </div>
    </div>
  );
}
