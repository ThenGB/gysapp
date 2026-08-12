import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectNoDocumentOverflow(page: Page) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

async function tabUntilFocused(page: Page, target: Locator, maxTabs = 40) {
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((node) => node === document.activeElement)) return;
  }
  throw new Error(`Target was not keyboard-focusable after ${maxTabs} Tab presses`);
}

function durationToMs(value: string): number {
  const first = value.split(',')[0]?.trim() ?? '0s';
  if (first.endsWith('ms')) return Number.parseFloat(first);
  if (first.endsWith('s')) return Number.parseFloat(first) * 1000;
  return Number.parseFloat(first);
}

test.describe('accessibility release regressions', () => {
  test('main shell does not horizontally overflow across the release viewport matrix', async ({
    page,
  }) => {
    const viewports = [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 600, height: 900 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/home');
      await expect(page.getByRole('heading', { name: 'Shalom' })).toBeVisible();
      await expectNoDocumentOverflow(page);
    }
  });

  test('reader reflows without horizontal page overflow at a 200% layout zoom equivalent', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 780, height: 900 });
    await page.goto('/bible/1/1');
    await expect(page.getByRole('heading', { name: 'Kejadian 1' }).first()).toBeVisible({
      timeout: 10_000,
    });

    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });

    await expect(page.getByText(/Pada mulanya Allah menciptakan/).first()).toBeVisible();
    await expectNoDocumentOverflow(page);
  });

  test('primary navigation is usable keyboard-only and exposes a visible focus ring', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/home');

    const bibleLink = page.getByRole('link', { name: 'Alkitab' }).first();
    await tabUntilFocused(page, bibleLink);

    const focusStyle = await bibleLink.evaluate((node) => {
      const style = getComputedStyle(node);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe('none');
    expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);

    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Kejadian 1' }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('reduced-motion preference collapses transition and animation durations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/home');

    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
      true,
    );

    const dockItem = page.locator('.dock-item').first();
    await expect(dockItem).toBeVisible();
    const durations = await dockItem.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        animation: style.animationDuration,
        transition: style.transitionDuration,
      };
    });

    expect(durationToMs(durations.animation)).toBeLessThanOrEqual(0.02);
    expect(durationToMs(durations.transition)).toBeLessThanOrEqual(0.02);
  });
});
