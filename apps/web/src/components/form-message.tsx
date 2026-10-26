'use client';
import { useTranslations } from 'next-intl';
import { APP_CONFIG } from '@paraapp/core';
import type { ActionState } from '@/lib/action-state';
import { Alert } from './ui';

/** Shows an action's error (keys under auth.errors) or a success message. */
export function FormMessage({ state, success }: { state: ActionState; success?: string }) {
  const t = useTranslations('auth.errors');
  if (state.error) {
    return <Alert tone="error">{t(state.error, { app: APP_CONFIG.name })}</Alert>;
  }
  if (state.ok && success) {
    return <Alert tone="success">{success}</Alert>;
  }
  return null;
}
