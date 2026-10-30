'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { profileSchema, ROLES, SUPER_ADMIN_ONLY_ROLES, type Role } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionState } from '@/lib/action-state';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { bool, str } from '@/lib/form';

const uuid = z.string().uuid();

/**
 * Grant or revoke a role. Granting "member" is how a club membership is verified. A person can
 * hold several roles at once (e.g. pilot, instructor and safety officer).
 */
export async function setRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const userId = str(formData, 'user_id');
  // The pressed button sends "role:1" to grant or "role:0" to revoke.
  const [roleValue = '', grantValue] = str(formData, 'toggle').split(':');
  const role = roleValue as Role;
  const grant = grantValue === '1';
  if (!viewer || !canUse(viewer, 'users') || !uuid.safeParse(userId).success) {
    return { error: 'generic' };
  }
  if (!ROLES.includes(role)) return { error: 'generic' };
  // Only the super admin manages admins, and nobody removes their own admin role by accident.
  // RLS enforces both.
  if (SUPER_ADMIN_ONLY_ROLES.includes(role)) {
    if (!viewer.roles.includes('super_admin')) return { error: 'admin.usersAdmin.notAllowed' };
    if (!grant && userId === viewer.user.id) return { error: 'admin.usersAdmin.notAllowed' };
  }
  const supabase = await createClient();
  const { error } = grant
    ? await supabase
        .from('user_roles')
        .insert({ user_id: userId, role, granted_by: viewer.user.id })
    : await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
  // 23505: the role was already there (e.g. a double click), which is what was asked for.
  if (error && error.code !== '23505') {
    console.error('setRole failed', error.code, error.message);
    return { error: error.code === '42501' ? 'admin.usersAdmin.notAllowed' : 'generic' };
  }
  revalidatePath('/[locale]/admin/users', 'layout');
  return { ok: true };
}

export async function setBan(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const userId = str(formData, 'user_id');
  // On/off: a ban lasts until an admin lifts it (stored as a date far in the future).
  const ban = str(formData, 'ban') === '1';
  if (!viewer || !canUse(viewer, 'users') || !uuid.safeParse(userId).success) return;
  const supabase = await createClient();
  await supabase.rpc('ban_user', {
    p_user: userId,
    p_until: ban ? '2999-12-31T00:00:00Z' : null,
    p_reason: str(formData, 'reason').slice(0, 500) || 'admin',
  });
  revalidatePath('/[locale]/admin/users', 'page');
}

const adminProfileSchema = profileSchema.pick({
  display_name: true,
  full_name: true,
  city: true,
  home_site: true,
  pilot_level: true,
  bio: true,
});

/**
 * Admins correct a member's profile and can remove an unsuitable photo. The database function
 * checks the role and writes the audit log; the photo file is deleted here with the service role.
 */
export async function updateUserProfile(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !canUse(viewer, 'users') || !uuid.safeParse(userId).success) {
    return { error: 'generic' };
  }
  const parsed = adminProfileSchema.safeParse({
    ...Object.fromEntries(formData),
    pilot_level: str(formData, 'pilot_level') || null,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data: removedPath, error } = await supabase.rpc('admin_update_profile', {
    p_user: userId,
    p_display_name: v.display_name,
    p_full_name: v.full_name ?? null,
    p_city: v.city ?? null,
    p_home_site: v.home_site ?? null,
    p_pilot_level: v.pilot_level ?? null,
    p_bio: v.bio ?? null,
    p_remove_photo: bool(formData, 'remove_photo'),
  });
  if (error) {
    return { error: error.code === '42501' ? 'admin.usersAdmin.notAllowed' : 'generic' };
  }
  if (removedPath) await createAdminClient().storage.from('avatars').remove([removedPath]);
  revalidatePath('/[locale]/admin/users', 'layout');
  revalidatePath('/[locale]/pilots/[id]', 'page');
  return { ok: true };
}
