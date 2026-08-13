import { expect, test } from '@playwright/test';

test('system theme follows OS color-scheme changes while the app stays open', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    localStorage.setItem(
      'gysapp.settings.v2',
      JSON.stringify({ theme: 'system', locale: 'id', comfortPreset: 'standard' }),
    );
  });

  await page.goto('/home');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
