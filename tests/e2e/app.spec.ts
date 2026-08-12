import { expect, test } from '@playwright/test';

test('home renders greeting and Sauh section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Shalom' })).toBeVisible();
  // Sauh dimuat dari snapshot statis (data/content/sauh.json).
  await expect(page.getByText('SAUH BAGI JIWA')).toBeVisible({ timeout: 15_000 });
});

test('navigation shell marks active tab and routes to bible reader', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Alkitab' }).first().click();
  await expect(page.getByRole('heading', { name: 'Kejadian 1' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Pada mulanya Allah menciptakan/)).toBeVisible();
});

test('faith page renders ten points with read-more links', async ({ page }) => {
  await page.goto('/faith');
  await expect(page.getByRole('heading', { name: 'Dasar Kepercayaan' })).toBeVisible();
  await expect(page.locator('.faith-item')).toHaveCount(10);
  await expect(page.getByRole('link', { name: /Baca Lebih Lanjut/ }).first()).toBeVisible();
});

test('hymnal catalog lists songs and opens a song', async ({ page }) => {
  await page.goto('/hymnal');
  await expect(page.getByRole('button', { name: 'KR', exact: true })).toBeVisible();
  await expect(page.locator('.hymnal-item').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.hymnal-item').first().click();
  await expect(page.getByRole('button', { name: 'Partitur', exact: true })).toBeVisible();
});

test('settings toggles dark theme', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Gelap' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Terang' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
