import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { requireActiveViewer } from '@/lib/session';
import { Button } from '@/components/ui';
import { EquipmentForm } from '../equipment-form';
import { deleteEquipment } from '../actions';

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('equipment');
  const common = await getTranslations('common');
  const supabase = await createClient();
  const { data: item } = await supabase
    .from('equipment')
    .select('*')
    .eq('id', id)
    .eq('user_id', viewer.user.id)
    .maybeSingle();
  if (!item) notFound();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
    new Date(),
  );
  const s = (v: string | number | null) => (v === null ? '' : String(v));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{t('edit')}</h2>
      <EquipmentForm
        id={item.id}
        today={today}
        values={{
          kind: item.kind,
          brand: s(item.brand),
          model: item.model,
          size: s(item.size),
          certification: s(item.certification),
          purchased_on: s(item.purchased_on),
          last_check_on: s(item.last_check_on),
          check_interval_months: s(item.check_interval_months),
          last_repack_on: s(item.last_repack_on),
          repack_interval_months: s(item.repack_interval_months),
          notes: s(item.notes),
        }}
      />
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-danger">{common('delete')}</summary>
        <form action={deleteEquipment} className="mt-3 space-y-2">
          <p className="text-sm">{t('deleteConfirm')}</p>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="locale" value={locale} />
          <Button variant="danger">{common('delete')}</Button>
        </form>
      </details>
    </div>
  );
}
