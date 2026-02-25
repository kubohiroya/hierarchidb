import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:4200/t/r');
await page.waitForSelector('[data-testid="console-table"], [data-tour-id="tree-table"]', { timeout: 30000 });
await page.waitForTimeout(1000);

const createButton = page.getByRole('button', { name: /^(作成|Create)$/ });
await createButton.click({ force: true });
await page.waitForTimeout(300);

const menuItems = await page.locator('[role="menuitem"]').allTextContents();
console.log('menuItems', JSON.stringify(menuItems, null, 2));

console.log('triggerCount', await page.locator('[data-testid="create-folder-submenu-trigger"]').count());
console.log('action1Count', await page.locator('[data-testid="create-folder-submenu-action-1"]').count());

if (await page.locator('[data-testid="create-folder-submenu-action-1"]').count() > 0) {
  console.log('action1', await page.locator('[data-testid="create-folder-submenu-action-1"]').innerText());
}

const trigger = page.locator('[data-testid="create-folder-submenu-trigger"]');
if (await trigger.count() > 0) {
  const info = await trigger.first().evaluate((el) => ({
    tag: el.tagName,
    role: el.getAttribute('role'),
    aria: el.getAttribute('aria-label'),
    visible: !!el.getClientRects().length,
    pointerEvents: getComputedStyle(el).pointerEvents,
    parentRole: el.parentElement ? el.parentElement.getAttribute('role') : null,
    isHidden: el.closest('[style*="visibility: hidden"], [hidden]') !== null,
  }));
  console.log('triggerInfo', info);
}

await browser.close();
