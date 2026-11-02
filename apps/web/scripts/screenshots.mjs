// Screenshots of the public pages of a deployed site, for design reviews.
// Usage: node apps/web/scripts/screenshots.mjs https://example.org out-dir
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const [base, out = 'screenshots'] = process.argv.slice(2);
if (!base) throw new Error('usage: screenshots.mjs <base-url> [out-dir]');

const pages = [
  ['home', '/tr'],
  ['home-en', '/en'],
  ['sites', '/tr/sites'],
  ['site', '/tr/sites/babadag'],
  ['events', '/tr/events'],
  ['trips', '/tr/trips'],
  ['news', '/tr/news'],
  ['fly', '/tr/fly'],
  ['sign-in', '/tr/auth/sign-in'],
  ['sos', '/tr/sos'],
];
const viewports = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const [device, options] of Object.entries(viewports)) {
  const context = await browser.newContext({ ...options, colorScheme: 'light', locale: 'tr-TR' });
  const page = await context.newPage();
  for (const [name, path] of pages) {
    await page.goto(base + path, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.screenshot({ path: `${out}/${device}-${name}.png`, fullPage: true });
  }
  if (device === 'phone') {
    // The open menu, to check it on a small screen.
    await page.goto(base + '/tr', { waitUntil: 'networkidle' });
    await page.locator('details summary').first().click();
    await page.screenshot({ path: `${out}/phone-menu-open.png` });
  }
  await context.close();
}
await browser.close();
