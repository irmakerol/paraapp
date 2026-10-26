'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './ui';

/** Copy link, plus the system share sheet where the browser has one. Nothing is sent anywhere. */
export function ShareButtons({
  path,
  title,
  imagePath,
}: {
  path: string;
  title: string;
  imagePath?: string;
}) {
  const t = useTranslations('flight');
  const [copied, setCopied] = useState(false);
  const url = () => new URL(path, window.location.origin).toString();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t('copyLink'), url());
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: url() });
      } catch {
        // Cancelled by the user.
      }
    } else {
      await copy();
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" onClick={copy} aria-live="polite">
        {copied ? t('copied') : t('copyLink')}
      </Button>
      <Button type="button" variant="secondary" onClick={share}>
        {t('shareButton')}
      </Button>
      {imagePath ? (
        <a
          href={imagePath}
          className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener"
        >
          {t('shareImage')}
        </a>
      ) : null}
    </div>
  );
}
