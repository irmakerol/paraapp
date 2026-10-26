'use client';
import { useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { toggleBookmark } from '../actions';

export function BookmarkButton({ tipId, saved }: { tipId: string; saved: boolean }) {
  const t = useTranslations('tips');
  const [state, setState] = useOptimistic(saved);
  const [pending, start] = useTransition();
  return (
    <Button
      variant={state ? 'primary' : 'secondary'}
      aria-pressed={state}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setState(!state);
          await toggleBookmark(tipId, !state);
        })
      }
    >
      <span aria-hidden>{state ? '★' : '☆'}</span> {state ? t('unbookmark') : t('bookmark')}
    </Button>
  );
}
