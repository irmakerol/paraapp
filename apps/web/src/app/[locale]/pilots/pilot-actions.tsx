'use client';
import { useActionState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { Button } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { messagePilot, setFollowing } from './actions';

export function FollowButton({ userId, following }: { userId: string; following: boolean }) {
  const t = useTranslations('pilots');
  const [pending, start] = useTransition();
  return (
    <Button
      variant={following ? 'secondary' : 'primary'}
      disabled={pending}
      aria-pressed={following}
      onClick={() => start(async () => void (await setFollowing(userId, !following)))}
    >
      {following ? t('unfollow') : t('follow')}
    </Button>
  );
}

export function MessageButton({ userId }: { userId: string }) {
  const t = useTranslations('pilots');
  const locale = useLocale();
  const [state, action] = useActionState(messagePilot, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="user_id" value={userId} />
      <SubmitButton variant="secondary">{t('message')}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
