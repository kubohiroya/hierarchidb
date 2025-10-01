import { test } from '@playwright/test';

const ENABLE_E2E = process.env.HIERARCHIDB_E2E === '1';

if (!ENABLE_E2E) {
  test.skip(true, 'Set HIERARCHIDB_E2E=1 to enable Playwright E2E tests.');
}
