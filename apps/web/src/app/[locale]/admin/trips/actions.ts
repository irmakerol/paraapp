'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  TRIP_EQUIPMENT,
  TRIP_PAYMENT_STATUSES,
  TRIP_REGISTRATION_STATUSES,
  tripSchema,
} from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { localeFrom, str } from '@/lib/form';
import { istanbulLocalToIso } from '@/lib/format';
import { slugWithSuffix } from '@/lib/slug';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

async function organiser() {
  const viewer = await getViewer();
  return viewer && canUse(viewer, 'trips') ? viewer : null;
}

function refresh() {
  revalidatePath('/[locale]/trips', 'layout');
  revalidatePath('/[locale]/admin/trips', 'layout');
}

/** Trip organisers, instructors and admins (RLS: private.is_trip_organiser()). */
export async function saveTrip(
  id: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await organiser();
  if (!viewer) return { error: 'generic' };
  if (id && !uuid.safeParse(id).success) return { error: 'generic' };
  const parsed = tripSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] =
        issue.message === 'order' ? 'trips.errors.order' : 'validation';
    return { error: 'validation', fieldErrors };
  }
  const d = parsed.data;
  const iso = (v: string | null) => (v ? istanbulLocalToIso(v) : null);
  const equipment = formData
    .getAll('required_equipment')
    .map(String)
    .filter((e): e is (typeof TRIP_EQUIPMENT)[number] =>
      (TRIP_EQUIPMENT as readonly string[]).includes(e),
    );
  const siteIds = formData
    .getAll('site_ids')
    .map(String)
    .filter((v) => uuid.safeParse(v).success);
  const guideIds = formData
    .getAll('guide_ids')
    .map(String)
    .filter((v) => uuid.safeParse(v).success);
  const coverPath = str(formData, 'cover_path');
  const values = {
    title: d.title,
    summary: d.summary ?? null,
    description_md: d.description_md,
    itinerary_md: d.itinerary_md,
    cover_path: /^trips\/[0-9a-f-]+\.webp$/.test(coverPath) ? coverPath : null,
    destination_country: d.destination_country,
    destination_region: d.destination_region ?? null,
    starts_on: d.starts_on,
    ends_on: d.ends_on,
    meeting_point: d.meeting_point ?? null,
    meeting_at: iso(d.meeting_at),
    registration_opens_at: iso(d.registration_opens_at),
    registration_deadline: iso(d.registration_deadline),
    max_pilots: d.max_pilots,
    min_pilots: d.min_pilots,
    companions_allowed: d.companions_allowed,
    min_pilot_level: d.min_pilot_level,
    min_years_flying: d.min_years_flying,
    min_flights: d.min_flights,
    required_equipment: equipment,
    requirements_md: d.requirements_md,
    price_amount: d.price_amount,
    price_currency: d.price_currency,
    deposit_amount: d.deposit_amount,
    payment_deadline: d.payment_deadline,
    payment_info_md: d.payment_info_md,
    price_includes: d.price_includes ?? null,
    price_excludes: d.price_excludes ?? null,
    cancellation_policy: d.cancellation_policy ?? null,
    accommodation: d.accommodation ?? null,
    transport: d.transport ?? null,
    members_only: d.members_only,
    allow_minors: d.allow_minors,
    auto_accept: d.auto_accept,
    status: d.status,
  };
  const supabase = await createClient();
  const result = id
    ? await supabase.from('trips').update(values).eq('id', id).select('id').single()
    : await supabase
        .from('trips')
        .insert({ ...values, slug: slugWithSuffix(d.title, 'trip'), created_by: viewer.user.id })
        .select('id')
        .single();
  if (result.error) return { error: 'generic' };
  const tripId = result.data.id;

  // Sites and guides are replaced as a whole, in the order chosen.
  await supabase.from('trip_sites').delete().eq('trip_id', tripId);
  if (siteIds.length)
    await supabase
      .from('trip_sites')
      .insert(siteIds.map((site_id, position) => ({ trip_id: tripId, site_id, position })));
  await supabase.from('trip_guides').delete().eq('trip_id', tripId);
  if (guideIds.length)
    await supabase.from('trip_guides').insert(
      guideIds.map((user_id, position) => ({
        trip_id: tripId,
        user_id,
        position,
        role_label: str(formData, `guide_role_${user_id}`).trim().slice(0, 60) || null,
      })),
    );

  refresh();
  if (!id) redirect(`/${localeFrom(formData)}/admin/trips/${tripId}`);
  return { ok: true };
}

export async function deleteTrip(formData: FormData): Promise<void> {
  const viewer = await organiser();
  const id = str(formData, 'id');
  if (!viewer || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from('trips').delete().eq('id', id);
  refresh();
  redirect(`/${localeFrom(formData)}/admin/trips`);
}

/** Staff (organisers and the trip's guides) decide on a registration and record payment. */
export async function updateParticipant(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = str(formData, 'registration_id');
  if (!uuid.safeParse(id).success) return { error: 'generic' };
  const status = z.enum(TRIP_REGISTRATION_STATUSES).safeParse(str(formData, 'status'));
  const payment = z.enum(TRIP_PAYMENT_STATUSES).safeParse(str(formData, 'payment_status'));
  if (!status.success || !payment.success) return { error: 'generic' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('trip_registrations')
    .update({
      status: status.data,
      payment_status: payment.data,
      staff_note: str(formData, 'staff_note').trim().slice(0, 500) || null,
    })
    .eq('id', id)
    .select('id');
  if (error)
    return { error: error.message.includes('trip_full') ? 'trips.errors.trip_full' : 'generic' };
  if (!data?.length) return { error: 'generic' };
  refresh();
  return { ok: true };
}

export async function notifyFollowers(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const tripId = str(formData, 'trip_id');
  if (!uuid.safeParse(tripId).success) return { error: 'generic' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('notify_trip_followers', {
    p_trip: tripId,
    p_include_registered: str(formData, 'include_registered') === 'on',
  });
  if (error) return { error: 'generic' };
  return { ok: true, values: { count: String(data ?? 0) } };
}

/** Opens a group chat with everyone accepted (adults only, like all group chats). */
export async function messageParticipants(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await getViewer();
  const tripId = str(formData, 'trip_id');
  if (!viewer || !uuid.safeParse(tripId).success) return { error: 'generic' };
  const supabase = await createClient();
  const [{ data: trip }, { data: regs }, { data: guides }] = await Promise.all([
    supabase.from('trips').select('title').eq('id', tripId).maybeSingle(),
    supabase
      .from('trip_registrations')
      .select('user_id')
      .eq('trip_id', tripId)
      .eq('status', 'accepted'),
    supabase.from('trip_guides').select('user_id').eq('trip_id', tripId),
  ]);
  const members = [...new Set([...(regs ?? []), ...(guides ?? [])].map((r) => r.user_id))].filter(
    (m) => m !== viewer.user.id,
  );
  if (!trip || !members.length) return { error: 'trips.errors.noParticipants' };
  const { data: chatId, error } = await supabase.rpc('create_group_chat', {
    p_title: trip.title.slice(0, 80),
    p_members: members.slice(0, 49),
  });
  if (error || !chatId) return { error: 'trips.errors.groupFailed' };
  redirect(`/${localeFrom(formData)}/messages/${chatId}`);
}

/** Admins: a draft news post that links to the trip, ready to edit and publish. */
export async function announceTrip(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const tripId = str(formData, 'trip_id');
  const locale = localeFrom(formData);
  if (!viewer || !canUse(viewer, 'news') || !uuid.safeParse(tripId).success) return;
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from('trips')
    .select('id, slug, title, summary, cover_path, news_id')
    .eq('id', tripId)
    .maybeSingle();
  if (!trip) return;
  if (trip.news_id) redirect(`/${locale}/admin/news/${trip.news_id}`);
  const link = `/${locale}/trips/${trip.slug}`;
  const { data: news } = await supabase
    .from('news')
    .insert({
      slug: slugWithSuffix(trip.title, 'trip'),
      locale,
      title: trip.title,
      summary: trip.summary,
      body_md:
        `${trip.summary ?? ''}\n\n[${locale === 'tr' ? 'Gezi sayfası ve kayıt' : 'Trip page and registration'}](${link})`.trim(),
      tags: [locale === 'tr' ? 'gezi' : 'trip'],
      cover_path: trip.cover_path,
      notify_on_publish: true,
      status: 'draft',
      author_id: viewer.user.id,
    })
    .select('id')
    .single();
  if (!news) return;
  await supabase.from('trips').update({ news_id: news.id }).eq('id', trip.id);
  redirect(`/${locale}/admin/news/${news.id}`);
}
