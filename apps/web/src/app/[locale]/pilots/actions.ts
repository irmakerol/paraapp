'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/session';
import { localeFrom, str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

/** Follow or unfollow. RLS: you can only follow as yourself, and not across a block. */
export async function setFollowing(userId: string, follow: boolean): Promise<boolean> {
  const user = await getUser();
  if (!user || !uuid.safeParse(userId).success || userId === user.id) return false;
  const supabase = await createClient();
  const { error } = follow
    ? await supabase.from('follows').insert({ follower_id: user.id, followee_id: userId })
    : await supabase.from('follows').delete().eq('follower_id', user.id).eq('followee_id', userId);
  revalidatePath(`/[locale]/pilots/${userId}`, 'page');
  return !error || error.code === '23505';
}

export async function messagePilot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const user = await getUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);
  const other = str(formData, 'user_id');
  if (!uuid.safeParse(other).success) return { error: 'generic' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_direct_chat', { p_other: other });
  if (error || !data) {
    if (error?.message.includes('minor')) return { error: 'chat.minorProtected' };
    if (error?.message.includes('blocked')) return { error: 'chat.blockedNotice' };
    return { error: 'chat.unavailable' };
  }
  redirect(`/${locale}/messages/${data}`);
}
