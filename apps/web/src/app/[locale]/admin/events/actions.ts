'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { eventSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { localeFrom, str } from '@/lib/form';
import { istanbulLocalToIso } from '@/lib/format';
import { slugWithSuffix } from '@/lib/slug';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

/** Instructors and admins organise events (RLS: private.is_event_organiser()). */
export async function saveEvent(
  id: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !canUse(viewer, 'events')) return { error: 'generic' };
  if (id && !uuid.safeParse(id).success) return { error: 'generic' };
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const d = parsed.data;
  const startsAt = istanbulLocalToIso(d.starts_at);
  const endsAt = istanbulLocalToIso(d.ends_at);
  if (!startsAt || !endsAt)
    return { error: 'validation', fieldErrors: { starts_at: 'validation' } };
  const values = {
    title: d.title,
    description_md: d.description_md,
    kind: d.kind,
    starts_at: startsAt,
    ends_at: endsAt,
    site_id: d.site_id,
    location_text: d.location_text ?? null,
    members_only: d.members_only,
    capacity: d.capacity,
    rsvp_deadline: d.rsvp_deadline ? istanbulLocalToIso(d.rsvp_deadline) : null,
    status: d.status,
  };
  const supabase = await createClient();
  const result = id
    ? await supabase.from('events').update(values).eq('id', id).select('id').single()
    : await supabase
        .from('events')
        .insert({ ...values, slug: slugWithSuffix(d.title, 'event'), created_by: viewer.user.id })
        .select('id')
        .single();
  if (result.error) return { error: 'generic' };
  revalidatePath('/[locale]/events', 'layout');
  revalidatePath('/[locale]/admin/events', 'layout');
  if (!id) redirect(`/${localeFrom(formData)}/admin/events/${result.data.id}`);
  return { ok: true };
}

export async function deleteEvent(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !canUse(viewer, 'events') || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from('events').delete().eq('id', id);
  revalidatePath('/[locale]/events', 'layout');
  redirect(`/${localeFrom(formData)}/admin/events`);
}
