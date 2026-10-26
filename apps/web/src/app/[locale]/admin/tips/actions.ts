'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { localeFrom, str } from '@/lib/form';
import { readTip, tipFieldErrors, uniqueSlug } from '@/lib/tips';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();
const statusSchema = z.enum(['draft', 'pending_review', 'published', 'rejected']);

/** Instructors, moderators and admins write tips and review suggestions. */
export async function saveTipAdmin(
  id: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !canUse(viewer, 'tips')) return { error: 'generic' };
  if (id && !uuid.safeParse(id).success) return { error: 'generic' };
  const parsed = readTip(formData);
  const status = statusSchema.safeParse(str(formData, 'status'));
  if (!parsed.success) return { error: 'validation', fieldErrors: tipFieldErrors(parsed.error) };
  if (!status.success) return { error: 'validation' };

  const supabase = await createClient();
  const { data: existing } = id
    ? await supabase.from('tips').select('published_at').eq('id', id).maybeSingle()
    : { data: null };
  const reviewed = status.data === 'published' || status.data === 'rejected';
  const values = {
    ...parsed.data,
    summary: parsed.data.summary ?? null,
    video_url: parsed.data.video_url ?? null,
    status: status.data,
    review_note: str(formData, 'review_note').trim().slice(0, 1000) || null,
    published_at:
      status.data === 'published'
        ? (existing?.published_at ?? new Date().toISOString())
        : (existing?.published_at ?? null),
    ...(reviewed ? { reviewed_by: viewer.user.id } : {}),
  };
  const result = id
    ? await supabase.from('tips').update(values).eq('id', id).select('id').single()
    : await supabase
        .from('tips')
        .insert({ ...values, slug: uniqueSlug(parsed.data.title), author_id: viewer.user.id })
        .select('id')
        .single();
  if (result.error) return { error: 'generic' };
  revalidatePath('/[locale]/tips', 'layout');
  revalidatePath('/[locale]/admin/tips', 'layout');
  if (!id) redirect(`/${localeFrom(formData)}/admin/tips/${result.data.id}`);
  return { ok: true };
}

export async function deleteTip(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !canUse(viewer, 'tips') || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from('tips').delete().eq('id', id);
  revalidatePath('/[locale]/tips', 'layout');
  redirect(`/${localeFrom(formData)}/admin/tips`);
}
