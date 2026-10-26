import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireActiveViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { PageTitle } from '@/components/ui';
import { AdForm } from '../../ad-form';

export default async function EditAdPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('common');
  const supabase = await createClient();
  const { data: ad } = await supabase
    .from('ads')
    .select('*, ad_photos(path, position)')
    .eq('id', id)
    .eq('owner_id', viewer.user.id)
    .maybeSingle();
  if (!ad) notFound();
  const s = (v: string | number | null) => (v === null ? '' : String(v));

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle>
        {t('edit')}: {ad.title}
      </PageTitle>
      <AdForm
        adId={ad.id}
        userId={viewer.user.id}
        photos={ad.ad_photos}
        canPostAsClub={viewer.roles.includes('admin')}
        values={{
          title: ad.title,
          category: ad.category,
          brand: s(ad.brand),
          model: s(ad.model),
          size: s(ad.size),
          weight_min: s(ad.weight_min),
          weight_max: s(ad.weight_max),
          year: s(ad.year),
          hours: s(ad.hours),
          flights: s(ad.flights),
          certification: s(ad.certification),
          last_check_date: s(ad.last_check_date),
          reserve_repack_date: s(ad.reserve_repack_date),
          condition: ad.condition,
          price: s(ad.price),
          currency: ad.currency,
          city: s(ad.city),
          location_text: s(ad.location_text),
          description: ad.description,
          is_club: ad.is_club,
        }}
      />
    </div>
  );
}
