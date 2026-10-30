'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { NOTICE_DAYS, noticeSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export async function postNotice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'generic' };
  if (viewer.profile.age_group !== 'adult') return { error: 'notices.adultsOnlyError' };
  const { photo, ...fields } = Object.fromEntries(formData);
  const parsed = noticeSchema.safeParse(fields);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const supabase = await createClient();

  // The browser has already resized the photo and re-encoded it as WebP (no EXIF/GPS).
  let photoPath: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES || photo.type !== 'image/webp')
      return { error: 'notices.photoError' };
    photoPath = `${viewer.user.id}/${crypto.randomUUID()}.webp`;
    const { error } = await supabase.storage
      .from('notice-photos')
      .upload(photoPath, photo, { contentType: 'image/webp' });
    if (error) return { error: 'notices.photoError' };
  }

  const { error } = await supabase
    .from('notices')
    .insert({ ...parsed.data, photo_path: photoPath, user_id: viewer.user.id });
  if (error) {
    if (photoPath) await supabase.storage.from('notice-photos').remove([photoPath]);
    return { error: 'generic' };
  }
  revalidatePath('/[locale]/notices', 'page');
  return { ok: true };
}

/** Close, reopen or renew your own notice (RLS: owner only, renewal capped at 30 days). */
export async function updateNoticeState(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !uuid.safeParse(id).success) return;
  const op = str(formData, 'op');
  const supabase = await createClient();
  const change =
    op === 'close'
      ? { closed: true }
      : op === 'reopen' || op === 'renew'
        ? {
            closed: false,
            expires_at: new Date(Date.now() + NOTICE_DAYS * 86400_000).toISOString(),
          }
        : null;
  if (!change) return;
  await supabase.from('notices').update(change).eq('id', id).eq('user_id', viewer.user.id);
  revalidatePath('/[locale]/notices', 'page');
}

export async function deleteNotice(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from('notices')
    .delete()
    .eq('id', id)
    .eq('user_id', viewer.user.id)
    .select('photo_path')
    .maybeSingle();
  if (data?.photo_path) await supabase.storage.from('notice-photos').remove([data.photo_path]);
  revalidatePath('/[locale]/notices', 'page');
}
