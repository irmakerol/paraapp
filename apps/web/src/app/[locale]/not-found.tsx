import { useTranslations } from 'next-intl';
import { PageTitle } from '@/components/ui';

export default function NotFound() {
  const t = useTranslations('legal');
  return <PageTitle>{t('notFound')}</PageTitle>;
}
