'use client';
import { useActionState, useOptimistic } from 'react';
import { useTranslations } from 'next-intl';
import { ROLES, SUPER_ADMIN_ONLY_ROLES, type Role } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { FormMessage } from '@/components/form-message';
import { setRole } from './actions';

/** One on/off pill per role; a person can hold several at once. */
export function RoleToggles({
  userId,
  roles,
  isSelf,
  isSuperAdmin,
}: {
  userId: string;
  roles: Role[];
  isSelf: boolean;
  isSuperAdmin: boolean;
}) {
  const t = useTranslations('admin.usersAdmin');
  const roleNames = useTranslations('roles');
  const [state, action, pending] = useActionState(setRole, initialState);
  // The pill flips at once; the server confirms (or the error shows and it flips back).
  const [shown, flip] = useOptimistic(roles, (current: Role[], toggle: string) => {
    const [role, grant] = toggle.split(':') as [Role, string];
    return grant === '1' ? [...current, role] : current.filter((r) => r !== role);
  });
  const submit = (formData: FormData) => {
    flip(String(formData.get('toggle') ?? ''));
    action(formData);
  };

  return (
    <div className="space-y-2">
      <form action={submit} className="flex flex-wrap gap-2" aria-label={t('roles')}>
        <input type="hidden" name="user_id" value={userId} />
        {ROLES.map((role) => {
          const has = shown.includes(role);
          const superOnly = SUPER_ADMIN_ONLY_ROLES.includes(role);
          // Admins see who is admin, but only the super admin can change it.
          if (superOnly && !isSuperAdmin && !has) return null;
          return (
            <button
              key={role}
              name="toggle"
              value={`${role}:${has ? '0' : '1'}`}
              aria-busy={pending}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
                has
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-background'
              }`}
              aria-pressed={has}
              title={has ? t('revoke') : t('grant')}
              disabled={pending || (superOnly && (!isSuperAdmin || (has && isSelf)))}
            >
              {has ? '✓ ' : '+ '}
              {roleNames(role)}
            </button>
          );
        })}
      </form>
      <FormMessage state={state} />
    </div>
  );
}
