'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ROLES, type Role } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { str } from '@/lib/form';

const uuid = z.string().uuid();

/** Grant or revoke a role. Granting "member" is how a club membership is verified. */
export async function setRole(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const userId = str(formData, 'user_id');
  const role = str(formData, 'role') as Role;
  const grant = str(formData, 'grant') === '1';
  if (!viewer || !canUse(viewer, 'users') || !uuid.safeParse(userId).success) return;
  if (!ROLES.includes(role)) return;
  // Admins cannot remove their own admin role by accident.
  if (!grant && role === 'admin' && userId === viewer.user.id) return;
  const supabase = await createClient();
  if (grant) {
    await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role, granted_by: viewer.user.id }, { ignoreDuplicates: true });
  } else {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
  }
  revalidatePath('/[locale]/admin/users', 'page');
}

export async function setBan(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const userId = str(formData, 'user_id');
  const days = Number(str(formData, 'days'));
  if (!viewer || !canUse(viewer, 'users') || !uuid.safeParse(userId).success) return;
  const supabase = await createClient();
  await supabase.rpc('ban_user', {
    p_user: userId,
    p_until: days > 0 ? new Date(Date.now() + days * 86400_000).toISOString() : null,
    p_reason: str(formData, 'reason').slice(0, 500) || 'admin',
  });
  revalidatePath('/[locale]/admin/users', 'page');
}
