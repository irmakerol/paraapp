'use client';
import { useTranslations } from 'next-intl';
import { APP_CONFIG } from '@paraapp/core';
import type { ActionState } from '@/lib/action-state';
import { Alert } from './ui';

/**
 * Shows an action's error or a success message. Error keys live under `auth.errors`
 * unless they contain a dot, in which case they are full keys (e.g. `market.adultsOnly`).
 */
export function FormMessage({ state, success }: { state: ActionState; success?: string }) {
  const t = useTranslations('auth.errors');
  const root = useTranslations();
  if (state.error) {
    const text = state.error.includes('.')
      ? root(state.error, { app: APP_CONFIG.name })
      : t(state.error, { app: APP_CONFIG.name });
    return <Alert tone="error">{text}</Alert>;
  }
  if (state.ok && success) {
    return <Alert tone="success">{success}</Alert>;
  }
  return null;
}
