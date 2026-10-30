'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { localeFrom, str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();
const groupSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null),
});

/** Admins create and rename user groups (RLS: private.is_admin()). */
export async function saveGroup(
  id: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !canUse(viewer, 'groups')) return { error: 'generic' };
  if (id && !uuid.safeParse(id).success) return { error: 'generic' };
  const parsed = groupSchema.safeParse({
    name: str(formData, 'name'),
    description: str(formData, 'description'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const supabase = await createClient();
  const result = id
    ? await supabase.from('user_groups').update(parsed.data).eq('id', id).select('id').single()
    : await supabase
        .from('user_groups')
        .insert({ ...parsed.data, created_by: viewer.user.id })
        .select('id')
        .single();
  if (result.error) {
    return result.error.code === '23505'
      ? { error: 'validation', fieldErrors: { name: 'admin.groupsAdmin.nameTaken' } }
      : { error: 'generic' };
  }
  revalidatePath('/[locale]/admin/groups', 'layout');
  if (!id) redirect(`/${localeFrom(formData)}/admin/groups/${result.data.id}`);
  return { ok: true };
}

export async function deleteGroup(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !canUse(viewer, 'groups') || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from('user_groups').delete().eq('id', id);
  revalidatePath('/[locale]/admin/groups', 'layout');
  redirect(`/${localeFrom(formData)}/admin/groups`);
}

/** Adds or removes one person; used on the group page and on a user's edit page. */
export async function setGroupMember(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const groupId = str(formData, 'group_id');
  const userId = str(formData, 'user_id');
  const add = str(formData, 'add') === '1';
  if (!viewer || !canUse(viewer, 'groups')) return;
  if (!uuid.safeParse(groupId).success || !uuid.safeParse(userId).success) return;
  const supabase = await createClient();
  if (add) {
    await supabase
      .from('user_group_members')
      .upsert(
        { group_id: groupId, user_id: userId, added_by: viewer.user.id },
        { ignoreDuplicates: true },
      );
  } else {
    await supabase
      .from('user_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
  }
  revalidatePath('/[locale]/admin/groups', 'layout');
  revalidatePath('/[locale]/admin/users', 'layout');
}
