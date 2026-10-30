/*
 * ParaApp service worker: push notifications and a small offline mode.
 *
 * Offline rules (privacy first):
 * - The SOS and offline pages are cached at install, fetched without cookies.
 * - Public pages (news, tips, sites, events, safety…) are cached when visited, but only if the
 *   response came from a signed-out request (the server marks signed-in responses with
 *   `x-paraapp-session`), so no personal page ever lands in the cache.
 * - Build files (/_next/static) are cached because their names change with every build.
 * - Nothing else (API, server actions, uploads, maps) is touched.
 */
const VERSION = 'v3';
const STATIC_CACHE = `paraapp-static-${VERSION}`;
const PAGE_CACHE = `paraapp-pages-${VERSION}`;
const MAX_PAGES = 40;
const LOCALES = ['tr', 'en'];
const PRECACHE = LOCALES.flatMap((l) => [`/${l}/sos`, `/${l}/offline`]);
const PUBLIC_PAGE = /^\/(tr|en)(\/(news|tips|sites|events|safety|sos|offline|legal)(\/.*)?)?\/?$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGE_CACHE);
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: 'omit' });
            if (res.ok) await cache.put(url, res);
          } catch {
            // Offline during install: try again next time.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC_CACHE, PAGE_CACHE];
      for (const key of await caches.keys()) {
        if (key.startsWith('paraapp-') && !keep.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.filter((r) => !PRECACHE.includes(new URL(r.url).pathname));
  for (const req of extra.slice(0, Math.max(0, extra.length - MAX_PAGES))) await cache.delete(req);
}

async function page(request) {
  const url = new URL(request.url);
  const cache = await caches.open(PAGE_CACHE);
  try {
    // One quick retry: a single failed request (e.g. while a new version goes live) should not
    // put up the offline page.
    const res = await fetch(request).catch(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return fetch(request);
    });
    if (
      res.ok &&
      res.type === 'basic' &&
      PUBLIC_PAGE.test(url.pathname) &&
      !res.headers.has('x-paraapp-session')
    ) {
      await cache.put(url.pathname + url.search, res.clone());
      void trim(cache);
    }
    return res;
  } catch {
    const locale = LOCALES.find((l) => url.pathname.startsWith(`/${l}`)) ?? 'tr';
    return (
      (await cache.match(url.pathname + url.search)) ??
      (await cache.match(`/${locale}/offline`)) ??
      new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    );
  }
}

async function staticFile(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(page(request));
  } else if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/brand/')) {
    event.respondWith(staticFile(request));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'ParaApp', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'ParaApp', {
      body: data.body || '',
      icon: '/brand/fly-anatolia-192.png',
      badge: '/brand/fly-anatolia-96.png',
      tag: data.tag,
      data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
