import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { Button } from '@/components/ui';
import { SiteForm } from '../site-form';
import { deleteSite } from '../actions';

export default async function EditSitePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'sites');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('admin.sitesAdmin');
  const common = await getTranslations('common');
  const supabase = await createClient();
  const { data: site } = await supabase.from('sites').select('*').eq('id', id).maybeSingle();
  if (!site) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{t('edit')}</h2>
        <Link href={`/sites/${site.slug}`} className="text-sm underline">
          /sites/{site.slug}
        </Link>
      </div>
      <SiteForm
        id={site.id}
        values={{
          name: site.name,
          slug: site.slug,
          kind: site.kind,
          lat: String(site.lat),
          lng: String(site.lng),
          elevation_m: site.elevation_m != null ? String(site.elevation_m) : '',
          region: site.region ?? '',
          wind_directions: site.wind_directions,
          description: site.description,
          rules: site.rules,
          verified: site.verified,
        }}
      />
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-danger">{common('delete')}</summary>
        <form action={deleteSite} className="mt-3 space-y-2">
          <p className="text-sm">{t('deleteConfirm')}</p>
          <input type="hidden" name="id" value={site.id} />
          <input type="hidden" name="locale" value={locale} />
          <Button variant="danger">{common('delete')}</Button>
        </form>
      </details>
    </div>
  );
}
