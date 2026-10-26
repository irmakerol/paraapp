'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { newsSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { bool, localeFrom, str } from '@/lib/form';
import { istanbulLocalToIso } from '@/lib/format';
import { notifyDueNews } from '@/lib/notify';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

export async function saveNews(
  id: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !canUse(viewer, 'news')) return { error: 'generic' };
  if (id && !uuid.safeParse(id).success) return { error: 'generic' };
  const status = str(formData, 'status');
  const publishAt = str(formData, 'published_at');
  const parsed = newsSchema.safeParse({
    title: str(formData, 'title'),
    slug: str(formData, 'slug'),
    locale: str(formData, 'news_locale'),
    summary: str(formData, 'summary'),
    body_md: str(formData, 'body_md'),
    tags: str(formData, 'tags')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    members_only: bool(formData, 'members_only'),
    pinned: bool(formData, 'pinned'),
    comments_enabled: bool(formData, 'comments_enabled'),
    notify_on_publish: bool(formData, 'notify_on_publish'),
    status,
    published_at:
      status === 'published'
        ? (istanbulLocalToIso(publishAt) ?? new Date().toISOString())
        : publishAt
          ? istanbulLocalToIso(publishAt)
          : null,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const coverPath = str(formData, 'cover_path') || null;
  const values = {
    ...parsed.data,
    summary: parsed.data.summary ?? null,
    cover_path: coverPath && coverPath.startsWith('news/') ? coverPath : null,
  };

  const supabase = await createClient();
  const result = id
    ? await supabase.from('news').update(values).eq('id', id).select('id').single()
    : await supabase
        .from('news')
        .insert({ ...values, author_id: viewer.user.id })
        .select('id')
        .single();
  if (result.error) {
    if (result.error.code === '23505') {
      return { error: 'validation', fieldErrors: { slug: 'admin.newsForm.slugTaken' } };
    }
    return { error: 'generic' };
  }
  if (values.status === 'published' && values.notify_on_publish) {
    await notifyDueNews();
  }
  revalidatePath('/[locale]/news', 'layout');
  revalidatePath('/[locale]/admin/news', 'layout');
  if (!id) redirect(`/${localeFrom(formData)}/admin/news/${result.data.id}`);
  return { ok: true };
}

export async function deleteNews(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !canUse(viewer, 'news') || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  const { data } = await supabase.from('news').select('cover_path').eq('id', id).maybeSingle();
  if (data?.cover_path) await supabase.storage.from('content').remove([data.cover_path]);
  await supabase.from('news').delete().eq('id', id);
  revalidatePath('/[locale]/news', 'layout');
  redirect(`/${localeFrom(formData)}/admin/news`);
}
