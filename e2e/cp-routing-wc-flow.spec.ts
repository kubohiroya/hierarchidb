/**
 * E2E: CP routing + Working Copy flow (CP always on)
 *
 * 注意:
 * - まだ仕様整備中のためデフォルト skip。準備が整い次第、有効化します。
 * - CP 経由は常時ON。必要に応じて以下のオプションフラグのみ使用します:
 *     WORKER_WC_COMMIT_V2=1 / WORKER_TRASH_USE_HOLDER=1 / WORKER_POLICY_C=1
 */

import { test, expect } from '@playwright/test';

test.describe.skip('CP routing + WC flow (always via CommandProcessor)', () => {
  test('baseline: create → update → move → remove → recover (CP path)', async ({ page }) => {
    // TODO: implement checks under CP path
    // - create/update via CP
    // - move/remove/recover via CP
    // - observable events & undo/redo minimal checks
    expect(1).toBe(1);
  });
});
