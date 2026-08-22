import { expect, test } from '@playwright/test';
import { buildAppUrl } from './utils/test-helpers';

test.describe('Location auth-required visualization (mock 401)', () => {
  test.skip(true, 'Wire up to UI flow when Location build/search UI is live');

  test('shows auth-required banner when 401 occurs', async ({ page }) => {
    await page.route('**/nominatim.openstreetmap.org/**', (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
        contentType: 'application/json',
      });
    });
    await page.goto(buildAppUrl());
    // TODO: Navigate to Location wizard and start a search that hits Nominatim
    // Expect banner in BuildProgressDialog
    // await expect(page.getByText('認証が必要です')).toBeVisible();
  });
});
