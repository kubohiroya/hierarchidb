/**
 * Helper functions for Shape cleanup in E2E tests
 */

import { Page } from '@playwright/test';

export interface ShapeCleanupOptions {
  shapeName: string;
  timeout?: number;
}

/**
 * Delete a test Shape by name
 */
export async function deleteTestShape(page: Page, options: ShapeCleanupOptions): Promise<boolean> {
  const { shapeName, timeout = 10000 } = options;

  try {
    console.log(`🗑️ Attempting to delete test Shape: ${shapeName}`);

    // Navigate to Resources if not already there
    try {
      await page.waitForSelector('text=Resources', { timeout: 5000 });
      await page.click('text=Resources');
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log('⚠️ Resources navigation failed, continuing...');
    }

    // Find the test Shape
    const shapeElement = page.locator(`text=${shapeName}`).first();
    if (!(await shapeElement.isVisible({ timeout: 3000 }))) {
      console.log(`ℹ️ Shape not found: ${shapeName}`);
      return false;
    }

    // Method 1: Right-click context menu
    try {
      await shapeElement.click({ button: 'right' });
      await page.waitForTimeout(1000);

      const deleteSelectors = [
        'text=削除',
        'text=Delete',
        'text=Remove',
        'button:has-text("削除")',
        'button:has-text("Delete")',
      ];

      for (const deleteSelector of deleteSelectors) {
        try {
          const deleteButton = page.locator(deleteSelector).first();
          if (await deleteButton.isVisible({ timeout: 2000 })) {
            await deleteButton.click();
            console.log(`✅ Clicked delete button for ${shapeName}`);

            // Confirm deletion
            await confirmDeletion(page);
            await page.waitForTimeout(2000);

            // Verify deletion
            if (!(await shapeElement.isVisible({ timeout: 2000 }))) {
              console.log(`✅ Successfully deleted ${shapeName}`);
              return true;
            }
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
    } catch (error) {
      console.log(`⚠️ Context menu deletion failed for ${shapeName}`);
    }

    // Method 2: Navigate to Shape and delete from settings
    try {
      await shapeElement.click();
      await page.waitForTimeout(2000);

      // Look for settings or delete option
      const settingsSelectors = [
        'text=設定',
        'text=Settings',
        'button[aria-label*="設定"]',
        'button[aria-label*="Settings"]',
        '[data-testid*="settings"]',
      ];

      for (const settingsSelector of settingsSelectors) {
        try {
          const settingsButton = page.locator(settingsSelector).first();
          if (await settingsButton.isVisible({ timeout: 2000 })) {
            await settingsButton.click();
            await page.waitForTimeout(1000);

            // Look for delete option in settings
            const deleteSelectors = [
              'text=削除',
              'text=Delete',
              'button:has-text("削除")',
              'button:has-text("Delete")',
            ];

            for (const deleteSelector of deleteSelectors) {
              try {
                const deleteButton = page.locator(deleteSelector).first();
                if (await deleteButton.isVisible({ timeout: 2000 })) {
                  await deleteButton.click();
                  console.log(`✅ Deleted ${shapeName} from settings`);

                  await confirmDeletion(page);
                  await page.waitForTimeout(2000);
                  return true;
                }
              } catch (error) {
                // Continue
              }
            }
            break;
          }
        } catch (error) {
          // Continue to next settings selector
        }
      }

      // Navigate back to Resources
      await page.click('text=Resources');
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log(`⚠️ Settings deletion failed for ${shapeName}:`, error.message);
    }

    console.log(`❌ Failed to delete ${shapeName}`);
    return false;
  } catch (error) {
    console.error(`❌ Error deleting ${shapeName}:`, error);
    return false;
  }
}

/**
 * Confirm deletion dialog
 */
async function confirmDeletion(page: Page): Promise<void> {
  const confirmSelectors = [
    'button:has-text("確認")',
    'button:has-text("OK")',
    'button:has-text("Yes")',
    'button:has-text("削除")',
    'button:has-text("Delete")',
  ];

  await page.waitForTimeout(1000);

  for (const confirmSelector of confirmSelectors) {
    try {
      const confirmButton = page.locator(confirmSelector).first();
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
        console.log('✅ Confirmed deletion');
        return;
      }
    } catch (error) {
      // Continue to next selector
    }
  }

  console.log('⚠️ No confirmation dialog found');
}

/**
 * Clean up all test Shapes
 */
export async function cleanupAllTestShapes(page: Page): Promise<void> {
  const testShapeNames = ['E2E Test Shape', 'E2E Empty State Test Shape', 'テスト用Shape'];

  console.log('🧹 Cleaning up all test Shapes...');

  for (const shapeName of testShapeNames) {
    await deleteTestShape(page, { shapeName });
  }

  console.log('✅ Test Shapes cleanup completed');
}

/**
 * Create a test Shape with the given name
 */
export async function createTestShape(page: Page, shapeName: string): Promise<boolean> {
  try {
    console.log(`📝 Creating test Shape: ${shapeName}`);

    // Navigate to Resources
    await page.waitForSelector('text=Resources', { timeout: 30000 });
    await page.click('text=Resources');
    await page.waitForTimeout(2000);

    // Look for "New シェイプ" button
    const newShapeSelectors = [
      'text=New シェイプ',
      'text=New Shape',
      'button:has-text("New")',
      'text=作成',
    ];

    for (const selector of newShapeSelectors) {
      try {
        const newShapeButton = page.locator(selector).first();
        if (await newShapeButton.isVisible({ timeout: 5000 })) {
          await newShapeButton.click();
          console.log(`Found New Shape button with selector: ${selector}`);

          // Wait for shape creation dialog/form
          await page.waitForTimeout(3000);

          // Fill in shape name
          const nameInputSelectors = [
            'input[placeholder*="名前"]',
            'input[placeholder*="name"]',
            'input[type="text"]',
          ];

          for (const nameSelector of nameInputSelectors) {
            try {
              const nameInput = page.locator(nameSelector).first();
              if (await nameInput.isVisible({ timeout: 3000 })) {
                await nameInput.fill(shapeName);
                console.log(`Filled shape name: ${shapeName}`);
                break;
              }
            } catch (error) {
              // Continue to next selector
            }
          }

          // Submit the form
          const createButtonSelectors = [
            'button:has-text("作成")',
            'button:has-text("Create")',
            'button:has-text("保存")',
            'button:has-text("Save")',
            'button[type="submit"]',
          ];

          for (const createSelector of createButtonSelectors) {
            try {
              const createButton = page.locator(createSelector).first();
              if (await createButton.isVisible({ timeout: 3000 })) {
                await createButton.click();
                console.log(`Clicked create button for ${shapeName}`);
                break;
              }
            } catch (error) {
              // Continue to next selector
            }
          }

          // Wait for shape to be created
          await page.waitForTimeout(3000);

          // Verify creation by looking for the shape
          const createdShape = page.locator(`text=${shapeName}`).first();
          if (await createdShape.isVisible({ timeout: 5000 })) {
            console.log(`✅ Successfully created test Shape: ${shapeName}`);
            return true;
          }

          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    console.log(`❌ Failed to create test Shape: ${shapeName}`);
    return false;
  } catch (error) {
    console.error(`❌ Error creating test Shape ${shapeName}:`, error);
    return false;
  }
}
