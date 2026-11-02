'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui';

/**
 * The service worker shows this page in place of the one asked for when the network request
 * failed. Reloads as soon as the site answers again, so a short hiccup does not leave it here.
 */
export function OfflineRetry({ label }: { label: string }) {
  useEffect(() => {
    // On /offline itself there is nothing to come back to.
    if (/^\/(tr|en)\/offline\/?$/.test(window.location.pathname)) return;
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok && !stopped) window.location.reload();
      } catch {
        // Still offline.
      }
    };
    const timer = window.setInterval(check, 5000);
    window.addEventListener('online', check);
    void check();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('online', check);
    };
  }, []);
  return (
    <Button type="button" onClick={() => window.location.reload()}>
      {label}
    </Button>
  );
}
