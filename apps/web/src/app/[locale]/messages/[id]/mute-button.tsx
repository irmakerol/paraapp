'use client';
import { useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { setMuted } from '../actions';

export function MuteButton({ chatId, muted }: { chatId: string; muted: boolean }) {
  const t = useTranslations('chat');
  const [state, setState] = useOptimistic(muted);
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      aria-pressed={state}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setState(!state);
          await setMuted(chatId, !state);
        })
      }
    >
      {state ? t('unmute') : t('mute')}
    </Button>
  );
}
