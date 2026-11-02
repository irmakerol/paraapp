'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Opens the phone app through its flyanatolia:// scheme. iOS silently ignores the link when the
 * app is not installed, or when the website runs as a home-screen web app, so after a moment we
 * explain what to do instead of leaving the pilot with a button that seems dead.
 */
export function OpenAppButton() {
  const t = useTranslations('fly');
  const [notOpened, setNotOpened] = useState(false);

  function open() {
    setNotOpened(false);
    const started = Date.now();
    const timer = window.setTimeout(() => {
      // Still here and visible: the app did not take over.
      if (document.visibilityState === 'visible' && Date.now() - started < 4000) setNotOpened(true);
    }, 1800);
    const cancel = () => {
      if (document.visibilityState === 'hidden') window.clearTimeout(timer);
    };
    document.addEventListener('visibilitychange', cancel, { once: true });
    window.location.href = 'flyanatolia://';
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={open}
        className="flex min-h-20 w-full items-center justify-center rounded-2xl bg-fly px-6 text-2xl font-bold text-white shadow-lg focus-visible:outline-4 focus-visible:outline-offset-2"
      >
        {t('openApp')}
      </button>
      {notOpened ? (
        <p role="status" className="rounded-xl border border-border bg-card p-4">
          {t('notOpened')}
        </p>
      ) : null}
    </div>
  );
}
