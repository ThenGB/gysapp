import { expect, test, type Page } from '@playwright/test';

async function expectNoDocumentOverflow(page: Page) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe('responsive release regressions', () => {
  test('mobile shell remains usable at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/home');

    await expect(page.getByRole('heading', { name: 'Shalom' })).toBeVisible();
    const dock = page.locator('.shell-dock');
    await expect(dock).toBeVisible();
    await expect(dock.locator('.dock-item')).toHaveCount(5);
    await expectNoDocumentOverflow(page);
  });

  test('Bible two-panel reader stays side-by-side in tablet landscape', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.goto('/bible/1/1');

    await expect(page.getByRole('heading', { name: 'Kejadian 1' }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Dua panel' }).click();

    const primary = page.locator('[data-pane="primary"]');
    const secondary = page.locator('[data-pane="secondary"]');
    await expect(primary).toBeVisible();
    await expect(secondary).toBeVisible();

    const primaryBox = await primary.boundingBox();
    const secondaryBox = await secondary.boundingBox();
    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    expect(primaryBox!.width).toBeGreaterThan(250);
    expect(secondaryBox!.width).toBeGreaterThan(250);
    expect(primaryBox!.x + primaryBox!.width).toBeLessThanOrEqual(secondaryBox!.x + 2);
    await expectNoDocumentOverflow(page);
  });

  test('Hymnal two-page guidance follows portrait and landscape orientation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/home');
    await page.evaluate(() => {
      localStorage.setItem(
        'gysapp.hymnal.viewer.v1',
        JSON.stringify({ pageMode: 2, fitMode: 'page', zoom: 1 }),
      );
    });
    await page.goto('/hymnal/KR/001');

    await expect(page.getByRole('button', { name: 'Partitur', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const hint = page.locator('.song-landscape-hint');
    await expect(hint).toBeVisible();

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(hint).toBeHidden();
    await expectNoDocumentOverflow(page);
  });

  test('persistent MIDI dock clears the mobile nav and survives route changes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hymnal/KR/001');

    const player = page.locator('.global-midi-dock .midi-player');
    const dock = page.locator('.shell-dock');
    await expect(player).toBeVisible({ timeout: 15_000 });
    await expect(dock).toBeVisible();

    const playerBox = await player.boundingBox();
    const dockBox = await dock.boundingBox();
    expect(playerBox).not.toBeNull();
    expect(dockBox).not.toBeNull();
    expect(playerBox!.y + playerBox!.height).toBeLessThanOrEqual(dockBox!.y + 1);

    await dock.getByRole('link', { name: 'Alkitab' }).click();
    await expect(page.getByRole('heading', { name: 'Kejadian 1' }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(player).toBeVisible();
    await expectNoDocumentOverflow(page);
  });

  test('e-GYS surface remains an external-service boundary', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/account');

    await expect(page.getByRole('heading', { name: 'e-GYS' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buka situs e-GYS' })).toBeVisible();
    await expect(page.getByText(/tidak meminta, menerima, atau menyimpan password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Google/i })).toHaveCount(0);
    await expectNoDocumentOverflow(page);
  });
});
