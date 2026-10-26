import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SiteOption, WingOption } from '@/components/flight-fields';

/** Sites and the viewer's own (not retired) wings, for flight forms. */
export async function flightFormOptions(
  userId: string,
): Promise<{ sites: SiteOption[]; wings: WingOption[] }> {
  const supabase = await createClient();
  const [{ data: sites }, { data: wings }] = await Promise.all([
    supabase.from('sites').select('id, name').order('name'),
    supabase
      .from('equipment')
      .select('id, brand, model, size')
      .eq('user_id', userId)
      .eq('kind', 'wing')
      .eq('retired', false)
      .order('created_at', { ascending: false }),
  ]);
  return {
    sites: sites ?? [],
    wings: (wings ?? []).map((w) => ({
      id: w.id,
      label: [w.brand, w.model, w.size].filter(Boolean).join(' '),
    })),
  };
}
