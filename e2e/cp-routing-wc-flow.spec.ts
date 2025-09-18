/**
 * E2E: CP routing + Working Copy flow (CP always on)
 *
 * 注意:
 * - まだ仕様整備中のためデフォルト skip。準備が整い次第、有効化します。
 * - CP/Trash/PolicyC/WC V2 は常時ON。オプションフラグの切替は不要になりました。
 */

import { test, expect } from '@playwright/test';
import { takeScreenshot } from './utils/test-helpers';

test.describe('CP routing + WC flow (parity OFF/ON labels)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('baseline [flags-off]: app boot + basic sanity', async ({ page }) => {
    await expect(page).toHaveURL(/http:\/\/localhost:4200\//);
    await takeScreenshot(page, 'cp-routing-wc-baseline-flags-off', { fullPage: false });
  });

  test('baseline [flags-on]: app boot + basic sanity', async ({ page }) => {
    await expect(page).toHaveURL(/http:\/\/localhost:4200\//);
    await takeScreenshot(page, 'cp-routing-wc-baseline-flags-on', { fullPage: false });
  });
});
