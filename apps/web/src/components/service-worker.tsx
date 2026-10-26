'use client';
import { useEffect } from 'react';

/** Registers the service worker (push + offline SOS and public pages) in production builds. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Not supported or blocked (e.g. private mode): the site works without it.
    });
  }, []);
  return null;
}
