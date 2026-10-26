import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageTitle } from './ui';

export async function ComingSoon({ locale, titleKey }: { locale: string; titleKey: string }) {
  setRequestLocale(locale);
  const nav = await getTranslations({ locale, namespace: 'nav' });
  const t = await getTranslations({ locale, namespace: 'comingSoon' });
  return (
    <>
      <PageTitle>{nav(titleKey)}</PageTitle>
      <Card>
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="mt-1 text-muted">{t('text')}</p>
      </Card>
    </>
  );
}
