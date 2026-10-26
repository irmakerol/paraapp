'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { siteSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { localeFrom, str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

/** Moderators and admins keep the sites database (RLS: private.is_moderator()). */
export async function saveSite(
  id: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !canUse(viewer, 'sites')) return { error: 'generic' };
  if (id && !uuid.safeParse(id).success) return { error: 'generic' };
  const parsed = siteSchema.safeParse({
    ...Object.fromEntries(formData),
    wind_directions: formData.getAll('wind_directions'),
    verified: formData.get('verified') === 'on',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const supabase = await createClient();
  const result = id
    ? await supabase.from('sites').update(parsed.data).eq('id', id).select('id').single()
    : await supabase
        .from('sites')
        .insert({ ...parsed.data, created_by: viewer.user.id })
        .select('id')
        .single();
  if (result.error) {
    return result.error.code === '23505'
      ? { error: 'validation', fieldErrors: { slug: 'admin.sitesAdmin.slugTaken' } }
      : { error: 'generic' };
  }
  revalidatePath('/[locale]/sites', 'layout');
  revalidatePath('/[locale]/admin/sites', 'layout');
  if (!id) redirect(`/${localeFrom(formData)}/admin/sites/${result.data.id}`);
  return { ok: true };
}

export async function deleteSite(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !canUse(viewer, 'sites') || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  // Flights keep their stats; their site link becomes empty (on delete set null).
  await supabase.from('sites').delete().eq('id', id);
  revalidatePath('/[locale]/sites', 'layout');
  redirect(`/${localeFrom(formData)}/admin/sites`);
}
