'use client';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { contactSeller } from '../actions';

export function ContactSeller({ adId, ownerId }: { adId: string; ownerId: string }) {
  const t = useTranslations('market');
  const locale = useLocale();
  const [state, action] = useActionState(
    (_prev: typeof initialState, formData: FormData) => contactSeller(formData),
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="ad_id" value={adId} />
      <input type="hidden" name="owner_id" value={ownerId} />
      <SubmitButton className="w-full">{t('contactSeller')}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
