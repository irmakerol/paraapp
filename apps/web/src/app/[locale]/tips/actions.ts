'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/session';
import { readTip, tipFieldErrors, uniqueSlug } from '@/lib/tips';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

/** Pilots suggest tips; an instructor or moderator reviews them. */
export async function suggestTip(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: 'common.signInToContinue' };
  const parsed = readTip(formData);
  if (!parsed.success) return { error: 'validation', fieldErrors: tipFieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from('tips').insert({
    ...parsed.data,
    summary: parsed.data.summary ?? null,
    video_url: parsed.data.video_url ?? null,
    slug: uniqueSlug(parsed.data.title),
    author_id: user.id,
    status: 'pending_review',
  });
  if (error) return { error: 'generic' };
  revalidatePath('/[locale]/tips/suggest', 'page');
  return { ok: true };
}

export async function toggleBookmark(tipId: string, saved: boolean): Promise<void> {
  const user = await getUser();
  if (!user || !uuid.safeParse(tipId).success) return;
  const supabase = await createClient();
  if (saved) {
    await supabase
      .from('tip_bookmarks')
      .upsert({ tip_id: tipId, user_id: user.id }, { ignoreDuplicates: true });
  } else {
    await supabase.from('tip_bookmarks').delete().eq('tip_id', tipId).eq('user_id', user.id);
  }
  revalidatePath('/[locale]/tips/saved', 'page');
}
