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

function parseRgb(value: string): [number, number, number] {
  const match = value.match(/rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Unsupported computed color: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance(value: string): number {
  const channels = parseRgb(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

async function resolvedThemeColors(page: Page, theme: 'light' | 'dark') {
  return page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    const probe = document.createElement('span');
    probe.style.position = 'fixed';
    probe.style.pointerEvents = 'none';
    probe.style.opacity = '0';
    document.body.append(probe);

    const resolve = (token: string) => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    };

    const result = {
      surface: resolve('--surface'),
      raised: resolve('--surface-raised'),
      primary: resolve('--text-primary'),
      secondary: resolve('--text-secondary'),
      tertiary: resolve('--text-tertiary'),
      accentText: resolve('--accent-text'),
      accent: resolve('--accent'),
      accentContrast: resolve('--accent-contrast'),
      focusRing: resolve('--focus-ring'),
    };
    probe.remove();
    return result;
  }, theme);
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

  test('Bible reader reflows at the effective CSS viewport of 200% browser zoom', async ({
    page,
  }) => {
    // Browser zoom changes the effective CSS viewport and therefore re-evaluates
    // media queries. A 780px-wide window at 200% zoom exposes about 390 CSS px.
    // CSS `zoom: 2` is intentionally not used here because it leaves media-query
    // width at 780px and creates a layout state real browser zoom does not produce.
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/bible/1/1');
    await expect(page.getByRole('heading', { name: 'Kejadian 1' }).first()).toBeVisible({
      timeout: 10_000,
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

  test('light and dark theme text tokens retain WCAG AA contrast', async ({ page }) => {
    await page.goto('/home');

    for (const theme of ['light', 'dark'] as const) {
      const colors = await resolvedThemeColors(page, theme);
      for (const foreground of [
        colors.primary,
        colors.secondary,
        colors.tertiary,
        colors.accentText,
      ]) {
        expect(
          contrastRatio(foreground, colors.surface),
          `${theme} text ${foreground} on ${colors.surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(colors.primary, colors.raised)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.accentContrast, colors.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.focusRing, colors.surface)).toBeGreaterThanOrEqual(3);
    }
  });

  test('reduced-motion preference collapses transition and animation durations', async ({
    page,
  }) => {
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
