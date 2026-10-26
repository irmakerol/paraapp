'use client';
import { useFormStatus } from 'react-dom';
import { Button } from './ui';
import type { ComponentProps } from 'react';

export function SubmitButton(props: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props} />
  );
}
