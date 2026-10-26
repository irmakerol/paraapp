'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { INCIDENT_STATUSES, lessonSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { localeFrom, str } from '@/lib/form';
import { slugWithSuffix } from '@/lib/slug';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

async function officer() {
  const viewer = await getViewer();
  return viewer && canUse(viewer, 'safety') ? viewer : null;
}

export async function updateIncident(formData: FormData): Promise<void> {
  const viewer = await officer();
  const id = str(formData, 'id');
  const status = z.enum(INCIDENT_STATUSES).safeParse(str(formData, 'status'));
  if (!viewer || !uuid.safeParse(id).success || !status.success) return;
  const supabase = await createClient();
  await supabase
    .from('incident_reports')
    .update({
      status: status.data,
      ...(formData.get('assign') === 'me' ? { assigned_to: viewer.user.id } : {}),
    })
    .eq('id', id);
  revalidatePath(`/[locale]/admin/safety/${id}`, 'page');
  revalidatePath('/[locale]/admin/safety', 'page');
}

export async function addIncidentNote(formData: FormData): Promise<void> {
  const viewer = await officer();
  const id = str(formData, 'id');
  const body = str(formData, 'body').trim().slice(0, 4000);
  if (!viewer || !uuid.safeParse(id).success || !body) return;
  const supabase = await createClient();
  await supabase
    .from('incident_notes')
    .insert({ incident_id: id, author_id: viewer.user.id, body });
  revalidatePath(`/[locale]/admin/safety/${id}`, 'page');
}

export async function saveLesson(
  id: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await officer();
  if (!viewer || (id && !uuid.safeParse(id).success)) return { error: 'generic' };
  const parsed = lessonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const supabase = await createClient();
  const { data: existing } = id
    ? await supabase.from('safety_lessons').select('published_at').eq('id', id).maybeSingle()
    : { data: null };
  const values = {
    ...parsed.data,
    summary: parsed.data.summary ?? null,
    published_at:
      parsed.data.status === 'published'
        ? (existing?.published_at ?? new Date().toISOString())
        : (existing?.published_at ?? null),
  };
  const result = id
    ? await supabase.from('safety_lessons').update(values).eq('id', id).select('id').single()
    : await supabase
        .from('safety_lessons')
        .insert({
          ...values,
          slug: slugWithSuffix(parsed.data.title, 'lesson'),
          author_id: viewer.user.id,
        })
        .select('id')
        .single();
  if (result.error) return { error: 'generic' };
  revalidatePath('/[locale]/safety', 'layout');
  if (!id) redirect(`/${localeFrom(formData)}/admin/safety/lessons/${result.data.id}`);
  return { ok: true };
}

export async function deleteLesson(formData: FormData): Promise<void> {
  const viewer = await officer();
  const id = str(formData, 'id');
  if (!viewer || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from('safety_lessons').delete().eq('id', id);
  revalidatePath('/[locale]/safety', 'layout');
  redirect(`/${localeFrom(formData)}/admin/safety/lessons`);
}
