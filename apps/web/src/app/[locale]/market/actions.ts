'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AD_STATUSES } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getUser, getViewer } from '@/lib/session';
import { bool, localeFrom } from '@/lib/form';
import { readAd } from '@/lib/ads';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

/** Creates or updates an ad. Photos are uploaded by the browser afterwards. */
export async function saveAd(adId: string | null, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'common.signInToContinue' };
  if (viewer.profile.age_group !== 'adult') return { error: 'market.adultsOnly' };
  if (adId && !uuid.safeParse(adId).success) return { error: 'generic' };
  const parsed = readAd(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const isAdmin = viewer.roles.includes('admin');
  const values = { ...parsed.data, is_club: isAdmin && bool(formData, 'is_club') };
  const supabase = await createClient();

  if (adId) {
    const { is_club: isClub, ...rest } = values;
    const { error } = await supabase
      .from('ads')
      .update(isAdmin ? { ...rest, is_club: isClub } : rest)
      .eq('id', adId)
      .eq('owner_id', viewer.user.id);
    if (error) return { error: 'generic' };
    revalidatePath('/[locale]/market', 'layout');
    return { ok: true, values: { id: adId } };
  }

  const id = crypto.randomUUID();
  const { error } = await supabase.from('ads').insert({ ...values, id, owner_id: viewer.user.id });
  if (error) return { error: 'generic' };
  revalidatePath('/[locale]/market', 'layout');
  return { ok: true, values: { id } };
}

export async function renewAd(formData: FormData): Promise<void> {
  const id = String(formData.get('id'));
  if (!uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.rpc('renew_ad', { p_ad: id });
  revalidatePath('/[locale]/market', 'layout');
}

export async function setAdStatus(formData: FormData): Promise<void> {
  const user = await getUser();
  const id = String(formData.get('id'));
  const status = String(formData.get('status')) as (typeof AD_STATUSES)[number];
  if (!user || !uuid.safeParse(id).success || !AD_STATUSES.includes(status)) return;
  const supabase = await createClient();
  await supabase.from('ads').update({ status }).eq('id', id).eq('owner_id', user.id);
  revalidatePath('/[locale]/market', 'layout');
}

export async function deleteAd(formData: FormData): Promise<void> {
  const user = await getUser();
  const id = String(formData.get('id'));
  if (!user || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  const { data: photos } = await supabase.from('ad_photos').select('path').eq('ad_id', id);
  if (photos?.length) await supabase.storage.from('ad-photos').remove(photos.map((p) => p.path));
  await supabase.from('ads').delete().eq('id', id).eq('owner_id', user.id);
  revalidatePath('/[locale]/market', 'layout');
  redirect(`/${localeFrom(formData)}/market/mine`);
}

/** Opens (or reuses) a conversation with the seller about this ad. */
export async function contactSeller(formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const user = await getUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);
  const adId = String(formData.get('ad_id'));
  const ownerId = String(formData.get('owner_id'));
  if (!uuid.safeParse(adId).success || !uuid.safeParse(ownerId).success) {
    return { error: 'generic' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_direct_chat', {
    p_other: ownerId,
    p_ad: adId,
  });
  if (error || !data) {
    if (error?.message.includes('minor')) return { error: 'chat.minorProtected' };
    if (error?.message.includes('blocked')) return { error: 'chat.blockedNotice' };
    return { error: 'chat.unavailable' };
  }
  redirect(`/${locale}/messages/${data}`);
}
