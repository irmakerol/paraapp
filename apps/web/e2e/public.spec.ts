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

test('coming-soon sections render in both languages', async ({ page }) => {
  await page.goto('/tr/market');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ekipman pazarı');
  await page.goto('/en/market');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gear market');
});
