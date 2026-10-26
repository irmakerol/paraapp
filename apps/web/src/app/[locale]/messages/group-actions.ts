'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { localeFrom, str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();
const title = z.string().trim().min(1).max(80);

function groupError(message: string | undefined): ActionState {
  if (message?.includes('member_not_allowed')) return { error: 'groups.memberNotAllowed' };
  if (message?.includes('group_full')) return { error: 'groups.full' };
  return { error: 'generic' };
}

/** Adults start a group with people they follow. The database checks age, blocks and size. */
export async function createGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'generic' };
  if (viewer.profile.age_group !== 'adult') return { error: 'groups.adultsOnly' };
  const name = title.safeParse(str(formData, 'title'));
  const members = formData.getAll('members').filter((m): m is string => uuid.safeParse(m).success);
  if (!name.success) return { error: 'validation', fieldErrors: { title: 'validation' } };
  if (!members.length || members.length > 49) {
    return { error: 'validation', fieldErrors: { members: 'groups.pickMembers' } };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_group_chat', {
    p_title: name.data,
    p_members: members,
  });
  if (error || !data) return groupError(error?.message);
  redirect(`/${localeFrom(formData)}/messages/${data}`);
}

export async function addGroupMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const chatId = str(formData, 'chat_id');
  const userId = str(formData, 'user_id');
  if (!viewer || !uuid.safeParse(chatId).success || !uuid.safeParse(userId).success) {
    return { error: 'generic' };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('add_group_member', { p_chat: chatId, p_user: userId });
  if (error) return groupError(error.message);
  revalidatePath(`/[locale]/messages/${chatId}`, 'page');
  return { ok: true };
}

export async function renameGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const chatId = str(formData, 'chat_id');
  const name = title.safeParse(str(formData, 'title'));
  if (!viewer || !uuid.safeParse(chatId).success) return { error: 'generic' };
  if (!name.success) return { error: 'validation', fieldErrors: { title: 'validation' } };
  const supabase = await createClient();
  const { error } = await supabase.rpc('rename_group_chat', { p_chat: chatId, p_title: name.data });
  if (error) return { error: 'generic' };
  revalidatePath(`/[locale]/messages/${chatId}`, 'page');
  return { ok: true };
}

/** Leave a group, or (as its creator) remove someone. */
export async function removeGroupMember(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const chatId = str(formData, 'chat_id');
  const userId = str(formData, 'user_id');
  if (!viewer || !uuid.safeParse(chatId).success || !uuid.safeParse(userId).success) return;
  const supabase = await createClient();
  await supabase.rpc('remove_group_member', { p_chat: chatId, p_user: userId });
  if (userId === viewer.user.id) redirect(`/${localeFrom(formData)}/messages`);
  revalidatePath(`/[locale]/messages/${chatId}`, 'page');
}
