'use client';
import { startTransition, type FormEvent } from 'react';

/**
 * React resets a <form action={…}> after the action runs. Selects then jump back to the value
 * they had when the page loaded (React does not update a select's default after mount), so a
 * saved choice looks lost. Submitting through this handler skips the reset and keeps what the
 * person sees; without JavaScript the form still posts through its `action`.
 * Elements outside the form linked with `form="…"` are included by FormData.
 */
export function keepValuesOnSubmit(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };
}
