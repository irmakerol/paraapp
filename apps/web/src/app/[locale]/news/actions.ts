'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { commentSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/session';
import { str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

export async function toggleLike(newsId: string, slug: string, like: boolean): Promise<void> {
  const user = await getUser();
  if (!user || !uuid.safeParse(newsId).success) return;
  const supabase = await createClient();
  if (like) {
    await supabase
      .from('news_likes')
      .upsert({ news_id: newsId, user_id: user.id }, { ignoreDuplicates: true });
  } else {
    await supabase.from('news_likes').delete().eq('news_id', newsId).eq('user_id', user.id);
  }
  revalidatePath(`/[locale]/news/${slug}`, 'page');
}

export async function addComment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: 'common.signInToContinue' };
  const newsId = str(formData, 'news_id');
  const parsed = commentSchema.safeParse({ body: str(formData, 'body') });
  if (!parsed.success || !uuid.safeParse(newsId).success) return { error: 'validation' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('news_comments')
    .insert({ news_id: newsId, author_id: user.id, body: parsed.data.body });
  if (error) return { error: 'generic' };
  revalidatePath(`/[locale]/news/${str(formData, 'slug')}`, 'page');
  return { ok: true };
}

export async function deleteComment(commentId: string, slug: string): Promise<void> {
  const user = await getUser();
  if (!user || !uuid.safeParse(commentId).success) return;
  const supabase = await createClient();
  // RLS allows authors and moderators.
  await supabase.from('news_comments').delete().eq('id', commentId);
  revalidatePath(`/[locale]/news/${slug}`, 'page');
}
