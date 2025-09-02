/**
 * E2E: CP routing + Working Copy flow (OFF/ON switch)
 *
 * 注意:
 * - まだ仕様整備中のためデフォルト skip。準備が整い次第、有効化します。
 * - 実行時は scripts/start-env.sh からフラグを注入してください。
 *   例)
 *     WORKER_USE_CMDPROC_CREATE_UPDATE=1 WORKER_USE_CMDPROC_MOVE_REMOVE=1 \
 *       ./scripts/start-env.sh development dev
 */

import { test, expect } from '@playwright/test';

test.describe.skip('CP routing + WC flow (flags OFF→ON)', () => {
  test('baseline (flags OFF): create/update/move/remove behave as legacy', async ({ page }) => {
    // TODO: implement baseline checks for legacy path
    expect(1).toBe(1);
  });

  test('flags ON: routes via CommandProcessor with identical UX', async ({ page }) => {
    // TODO: implement checks under flags ON
    // - create/update via CP
    // - move/remove via CP (Phase 2)
    // - observable events & undo/redo minimal checks
    expect(1).toBe(1);
  });
});

