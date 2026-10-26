'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './ui';

/**
 * Click-to-load video. Nothing is requested from YouTube/Vimeo until the reader agrees,
 * so no third-party cookies or requests happen on page view.
 */
export function VideoEmbed({ src, title }: { src: string; title: string }) {
  const t = useTranslations('tips');
  const [loaded, setLoaded] = useState(false);
  const host = src.includes('vimeo') ? 'Vimeo' : 'YouTube';
  if (!loaded) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-brand-navy p-6 text-center text-white">
        <Button variant="secondary" onClick={() => setLoaded(true)}>
          ▶ {t('loadVideo', { host })}
        </Button>
        <p className="max-w-md text-sm opacity-80">{t('videoNotice', { host })}</p>
      </div>
    );
  }
  return (
    <iframe
      src={`${src}${src.includes('?') ? '&' : '?'}autoplay=1`}
      title={title}
      className="aspect-video w-full rounded-2xl"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
      loading="lazy"
    />
  );
}
