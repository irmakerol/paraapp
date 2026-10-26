'use client';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { setBlocked } from '@/lib/community-actions';
import { Button } from './ui';

export function BlockButton({ userId, blocked }: { userId: string; blocked: boolean }) {
  const t = useTranslations('common');
  const [pending, start] = useTransition();
  return (
    <Button
      variant={blocked ? 'secondary' : 'ghost'}
      disabled={pending}
      onClick={() => start(async () => void (await setBlocked(userId, !blocked)))}
    >
      {blocked ? t('unblock') : t('block')}
    </Button>
  );
}
