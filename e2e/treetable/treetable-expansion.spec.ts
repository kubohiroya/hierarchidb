import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  buildAppUrl,
  clearTestData,
  createChildFolder,
  createTestFolder,
  dismissGuidedTour,
  setupConsoleErrorTracking,
  waitForSubTreeUpdate,
  waitForTreeTableLoad,
} from '../utils/test-helpers';

/**
 * TreeTable Expansion E2E Tests
 *
 * Tests node expansion and collapse against the current TreeTable UI.
 */

const expandableNode = (page: Page): Locator =>
  page.locator('[data-testid="console-node"][data-has-children="true"]').first();

async function createExpandableFixture(page: Page, baseName: string): Promise<string> {
  const parentName = await createTestFolder(page, `${baseName} Parent`);
  const parentNode = page
    .locator('[data-testid="console-node"]')
    .filter({ hasText: parentName })
    .first();
  await createChildFolder(page, parentNode, `${baseName} Child`);
  return parentName;
}

async function expandFirstNode(page: Page): Promise<Locator> {
  const node = expandableNode(page);
  await expect(node).toBeVisible();
  await node.locator('[data-testid="expand-button"]').click();
  await waitForSubTreeUpdate(page);
  await expect(node.locator('[data-testid="expand-icon"]')).toHaveAttribute(
    'data-expanded',
    'true'
  );
  return node;
}

test.describe('TreeTable Expansion', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
  });

  test('個別ノードの展開・折りたたみ', async ({ page }) => {
    await createExpandableFixture(page, 'Expandable');

    const node = expandableNode(page);
    await expect(node).toBeVisible();
    await expect(node.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'false'
    );

    await node.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);
    await expect(node.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );

    const parentId = await node.getAttribute('data-node-id');
    const childNodes = page.locator(`[data-testid="tree-node"][data-parent-id="${parentId}"]`);
    await expect.poll(async () => childNodes.count()).toBeGreaterThanOrEqual(1);

    await node.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);
    await expect(node.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'false'
    );
    await expect(childNodes).toHaveCount(0);
  });

  test('キーボードによる展開・折りたたみ', async ({ page }) => {
    await createExpandableFixture(page, 'Keyboard');

    const node = expandableNode(page);
    const expandButton = node.locator('[data-testid="expand-button"]');
    await expandButton.focus();

    await page.keyboard.press('Enter');
    await waitForSubTreeUpdate(page);
    await expect(node.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );

    await expandButton.focus();
    await page.keyboard.press('Space');
    await waitForSubTreeUpdate(page);
    await expect(node.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'false'
    );
  });

  test('複数ノードの展開・折りたたみ', async ({ page }) => {
    await createExpandableFixture(page, 'First');
    await createExpandableFixture(page, 'Second');

    const nodes = page.locator('[data-testid="console-node"][data-has-children="true"]');
    await expect.poll(async () => nodes.count()).toBeGreaterThanOrEqual(2);

    const count = await nodes.count();
    for (let i = 0; i < count; i += 1) {
      await nodes.nth(i).locator('[data-testid="expand-button"]').click();
      await waitForSubTreeUpdate(page);
      await expect(nodes.nth(i).locator('[data-testid="expand-icon"]')).toHaveAttribute(
        'data-expanded',
        'true'
      );
    }

    for (let i = 0; i < count; i += 1) {
      await nodes.nth(i).locator('[data-testid="expand-button"]').click();
      await waitForSubTreeUpdate(page);
      await expect(nodes.nth(i).locator('[data-testid="expand-icon"]')).toHaveAttribute(
        'data-expanded',
        'false'
      );
    }
  });

  test('ネストされた階層の展開', async ({ page }) => {
    await createExpandableFixture(page, 'Nested');
    const topLevelNode = await expandFirstNode(page);
    const topLevelId = await topLevelNode.getAttribute('data-node-id');

    const childNodes = page.locator(`[data-testid="tree-node"][data-parent-id="${topLevelId}"]`);
    await expect.poll(async () => childNodes.count()).toBeGreaterThanOrEqual(1);

    const indentLevel = await childNodes.first().evaluate((el) => {
      const style = getComputedStyle(el);
      return style.paddingLeft || style.marginLeft;
    });
    expect(indentLevel).toBeTruthy();
  });

  test('展開状態の永続化', async ({ page }) => {
    await createExpandableFixture(page, 'Persisted');
    const node = await expandFirstNode(page);
    const nodeId = await node.getAttribute('data-node-id');

    await page.reload();
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    const reloadedNode = page.locator(`[data-testid="console-node"][data-node-id="${nodeId}"]`);
    await expect(reloadedNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );
  });

  test('展開操作が旧HTTP SubTree APIに依存しないこと', async ({ page }) => {
    await createExpandableFixture(page, 'Worker');
    await page.route('**/api/subtree/**', (route) => route.abort());

    await expandFirstNode(page);
  });

  test('大量ノードでの展開パフォーマンス', async ({ page }) => {
    await createExpandableFixture(page, 'Performance');
    const node = expandableNode(page);

    const startTime = Date.now();
    await node.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page, 10000);
    const expandTime = Date.now() - startTime;

    expect(expandTime).toBeLessThan(3000);
    await expect(node.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );
  });

  test('タブレット幅での展開操作', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await createExpandableFixture(page, 'Touch');

    const node = expandableNode(page);
    await node.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);
    await expect(node.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );
  });

  test('展開状態とフィルタリングの組み合わせ', async ({ page }) => {
    const parentName = await createExpandableFixture(page, 'Filtered');
    const node = await expandFirstNode(page);

    const search = page.getByRole('textbox', { name: 'ツリー検索' });
    await search.fill(parentName);
    await page.waitForTimeout(500);
    await expect(node.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );

    await search.fill('');
    await page.waitForTimeout(500);
    await expect(node.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );
  });
});
