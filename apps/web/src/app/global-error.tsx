'use client';
import tr from '@/messages/tr.json';
import en from '@/messages/en.json';

/**
 * Last resort when the root layout itself fails: no providers are available here, so the texts
 * come straight from the message files, Turkish first.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: '2rem', lineHeight: 1.5 }}>
        <h1>{tr.errors.error}</h1>
        <p lang="en">{en.errors.error}</p>
        <p>
          <button type="button" onClick={reset} style={{ minHeight: 44, padding: '0 1rem' }}>
            {tr.errors.retry} / {en.errors.retry}
          </button>
        </p>
        <p>
          {/* A full page load on purpose: the app shell is broken at this point. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/tr/sos">SOS</a>
        </p>
      </body>
    </html>
  );
}
