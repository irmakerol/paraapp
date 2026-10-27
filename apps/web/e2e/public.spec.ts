import { expect, test } from '@playwright/test';

// These flows need no backend: signed-out pages and checks that run before Supabase is called.

test.describe('Turkish browser', () => {
  test.use({ locale: 'tr-TR' });
  test('redirects to Turkish and renders the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/tr$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      "Türkiye'nin yamaç paraşütü topluluğu",
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  });
});

test.describe('browser with no supported language', () => {
  test.use({ locale: 'de-DE' });
  test('falls back to Turkish', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/tr$/);
  });
});

test('switches language to English', async ({ page }) => {
  await page.goto('/tr');
  await page.getByRole('banner').getByLabel('Dil').first().selectOption('en');
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'The paragliding community of Türkiye',
  );
});

test('sign-up rejects users under 14 before contacting the backend', async ({ page }) => {
  await page.goto('/en/auth/sign-up');
  const today = new Date();
  const young = new Date(
    Date.UTC(today.getUTCFullYear() - 13, today.getUTCMonth(), today.getUTCDate()),
  );
  await page.getByLabel('Display name').fill('Young Pilot');
  await page.getByLabel('Email').fill('young@example.com');
  await page.getByLabel('Password').fill('longenough123');
  await page.getByLabel('Date of birth').fill(young.toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert').first()).toContainText('at least 14');
});

test('account pages require sign-in', async ({ page }) => {
  await page.goto('/en/account');
  await expect(page).toHaveURL(/\/en\/auth\/sign-in$/);
});

test('community sections render in both languages', async ({ page }) => {
  await page.goto('/tr/market');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ekipman pazarı');
  await expect(page.getByRole('search')).toBeVisible();
  await page.goto('/en/market');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gear market');
  await page.goto('/en/news');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('News');
  await page.goto('/en/tips');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tips & tricks');
  await expect(page.getByRole('link', { name: 'Cross-country' })).toBeVisible();
});

test('tips can be filtered by category', async ({ page }) => {
  await page.goto('/en/tips');
  await expect(page.getByRole('link', { name: 'Weather & meteorology' })).toHaveAttribute(
    'href',
    '/en/tips?category=weather',
  );
  await page.goto('/en/tips?category=weather');
  await expect(page.getByRole('link', { name: 'Weather & meteorology' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('messages, posting ads and admin require sign-in', async ({ page }) => {
  for (const path of [
    '/en/messages',
    '/en/market/new',
    '/en/admin',
    '/en/tips/suggest',
    '/en/trips/mine',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/auth\/sign-in$/);
  }
});

test('sites page renders in both languages', async ({ page }) => {
  await page.goto('/tr/sites');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Uçuş alanları');
  await page.goto('/en/sites');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Flying sites');
});

test('trips page renders in both languages', async ({ page }) => {
  await page.goto('/tr/trips');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Geziler');
  await page.goto('/en/trips');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Trips');
});

test('logbook pages require sign-in', async ({ page }) => {
  for (const path of [
    '/en/logbook',
    '/en/logbook/import',
    '/en/logbook/new',
    '/en/logbook/equipment',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/auth\/sign-in$/);
  }
});

test('logbook export needs a session', async ({ request }) => {
  const res = await request.get('/api/logbook/export');
  expect(res.status()).toBe(401);
});

test('safety, events and SOS pages render without an account', async ({ page }) => {
  await page.goto('/en/safety');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Safety');
  await page.goto('/tr/events');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Etkinlikler');
  await page.goto('/en/sos');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emergency');
  await expect(page.getByRole('link', { name: 'Call 112' })).toHaveAttribute('href', 'tel:112');
});

test('rides, reporting and group chats require sign-in', async ({ page }) => {
  for (const path of ['/en/rides', '/en/safety/report', '/en/messages/new-group']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/auth\/sign-in$/);
  }
});

test('unknown pages show the localised not-found page', async ({ page }) => {
  const res = await page.goto('/tr/bu-sayfa-yok');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sayfa bulunamadı');
  await expect(page.getByRole('link', { name: 'Ana sayfaya git' })).toBeVisible();
});

test('launch plumbing: health, robots, sitemap, security headers, service worker', async ({
  request,
}) => {
  const health = await request.get('/api/health');
  expect(await health.json()).toEqual({ ok: true });

  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /*/messages');
  expect(robots).toContain('Sitemap: ');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain('/en/sos</loc>');

  const home = await request.get('/en');
  const csp = home.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain('https://tiles.openfreemap.org');
  expect(home.headers()['x-paraapp-session']).toBeUndefined();

  const sw = await request.get('/sw.js');
  expect(sw.headers()['cache-control']).toContain('no-cache');
});

test('the SOS page works offline once the service worker is installed', async ({
  page,
  context,
}) => {
  await page.goto('/en');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Wait until the install step has stored the SOS page.
  await page.waitForFunction(async () => Boolean(await caches.match('/en/sos')));
  await context.setOffline(true);
  await page.goto('/en/sos');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emergency');
  await page.goto('/en/logbook');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You are offline');
  await context.setOffline(false);
});
