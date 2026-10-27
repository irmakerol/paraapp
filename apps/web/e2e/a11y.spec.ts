import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Automated WCAG 2.1 AA checks on pages that render without a backend. Axe finds roughly a third
// of real problems (contrast, labels, landmarks, names); keyboard and screen-reader checks stay manual.
const PAGES = [
  '/tr',
  '/en',
  '/en/news',
  '/en/tips',
  '/en/market',
  '/en/sites',
  '/en/events',
  '/en/trips',
  '/en/safety',
  '/en/sos',
  '/en/auth/sign-in',
  '/en/auth/sign-up',
  '/en/legal/privacy_notice',
  '/en/offline',
  '/en/this-page-does-not-exist',
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });
    for (const path of PAGES) {
      test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
        await page.goto(path);
        // Let theme and hover transitions settle so colours are measured in their final state.
        await page.waitForFunction(() =>
          document.getAnimations().every((a) => a.playState !== 'running'),
        );
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        const summary = violations.map(
          (v) =>
            `${v.id}: ${v.nodes
              .map((n) => n.target.join(' '))
              .slice(0, 5)
              .join(', ')}`,
        );
        expect(summary).toEqual([]);
      });
    }
  });
}
