import { test, expect } from '@playwright/test';

const storyUrl = (id: string, args?: Record<string, string>) => {
  const params = new URLSearchParams({ id });
  if (args) {
    params.set('args', Object.entries(args).map(([k, v]) => `${k}:${v}`).join(';'));
  }
  return `/?${params.toString()}`;
};

test.describe('HeadlessMultiStepDialog display modes', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

test('switches between normal, maximize, and full-screen', async ({ page }) => {
    await page.goto(storyUrl('ui-headless-headlessmultistepdialog--default'));
    const iframe = page.frameLocator('iframe[title="storybook-preview"]');

    await iframe.getByRole('button', { name: 'Open dialog' }).click();

    const dialog = iframe.locator('div', { hasText: 'Headless dialog' }).first();
    await expect(dialog).toBeVisible();

    const backButton = iframe.getByRole('button', { name: 'Back' });
    await expect(backButton).toBeDisabled();

    await iframe.getByRole('button', { name: 'Next' }).click();
    await expect(backButton).toBeEnabled();

    await iframe.getByRole('button', { name: 'Next' }).click();
    await expect(iframe.getByRole('button', { name: 'Submit' })).toBeDisabled();

    await iframe.getByRole('button', { name: 'Back' }).click();
    await expect(iframe.getByRole('heading', { name: /Members/ })).toBeVisible();

    await iframe.locator('select').selectOption('maximize');
    await expect(iframe.locator('select')).toHaveValue('maximize');

  await iframe.locator('select').selectOption('full-screen');
  await expect(iframe.locator('select')).toHaveValue('full-screen');

    await iframe.locator('select').selectOption('normal');
    await expect(iframe.locator('select')).toHaveValue('normal');
  });
});
