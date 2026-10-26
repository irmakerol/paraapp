import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireActiveViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { AD_LIST_COLUMNS } from '@/lib/ads';
import { currentTime, formatDate } from '@/lib/format';
import { Alert, Button, buttonClass, Card, PageTitle } from '@/components/ui';
import { AdCard } from '@/components/ad-card';
import { renewAd } from '../actions';

export default async function MyAdsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('market');
  const supabase = await createClient();
  const { data: ads } = await supabase
    .from('ads')
    .select(`${AD_LIST_COLUMNS}, removed_at`)
    .eq('owner_id', viewer.user.id)
    .order('created_at', { ascending: false });
  const soon = currentTime() + 7 * 86400_000;
  const expiring = (ads ?? []).filter(
    (ad) =>
      (ad.status === 'active' || ad.status === 'reserved') &&
      !ad.removed_at &&
      new Date(ad.expires_at).getTime() < soon,
  );

  return (
    <>
      <PageTitle>{t('myAds')}</PageTitle>
      {expiring.length ? (
        <div className="mb-4 space-y-2">
          {expiring.map((ad) => (
            <Alert key={ad.id}>{t('expiringSoon', { title: ad.title })}</Alert>
          ))}
        </div>
      ) : null}
      <Link href="/market/new" className={buttonClass('primary', 'mb-6')}>
        {t('newAd')}
      </Link>
      {!ads?.length ? (
        <Card>
          <p className="text-muted">{t('noAds')}</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ads.map((ad) => (
            <li key={ad.id} className="space-y-2">
              <AdCard ad={ad} locale={locale} />
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted">
                  {t('expires', { date: formatDate(ad.expires_at, locale) })}
                </span>
                {ad.status !== 'sold' && !ad.removed_at ? (
                  <form action={renewAd}>
                    <input type="hidden" name="id" value={ad.id} />
                    <Button variant="ghost" className="min-h-9 px-2 text-sm">
                      {t('renew')}
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
