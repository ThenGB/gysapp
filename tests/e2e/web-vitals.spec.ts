import { expect, test } from '@playwright/test';

type LabVitals = { lcp: number; cls: number };

test.describe('production-preview performance guard', () => {
  test('Home stays within lab LCP and CLS release budgets', async ({ page }) => {
    await page.addInitScript(() => {
      const state = { lcp: 0, cls: 0 };
      Object.defineProperty(window, '__gysappLabVitals', {
        value: state,
        configurable: false,
        writable: false,
      });

      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) state.lcp = Math.max(state.lcp, entry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // Older engines may not expose LCP. Chromium CI does.
      }

      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
            if (!shift.hadRecentInput) state.cls += shift.value ?? 0;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {
        // Older engines may not expose layout-shift. Chromium CI does.
      }
    });

    await page.goto('/home');
    await expect(page.getByRole('heading', { name: 'Shalom' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const vitals = await page.evaluate(
      () =>
        (window as unknown as { __gysappLabVitals: LabVitals }).__gysappLabVitals,
    );

    expect(vitals.lcp, 'LCP observer should capture a paint').toBeGreaterThan(0);
    expect(vitals.lcp, 'local production-preview LCP regression budget').toBeLessThanOrEqual(2500);
    expect(vitals.cls, 'local production-preview CLS regression budget').toBeLessThanOrEqual(0.1);
  });
});
