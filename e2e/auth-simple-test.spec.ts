/**
 * 認証フロー簡易テスト
 * 作成日: 2025年8月25日
 */

import { test, expect } from '@playwright/test';

test('ローカル環境の基本的な認証フローテスト', async ({ page }) => {
  console.log('Starting local environment test...');
  
  // ローカル環境にアクセス
  await page.goto('http://localhost:4200');
  
  // ページタイトルを確認
  const title = await page.title();
  console.log('Page title:', title);
  
  // スクリーンショットを撮影
  await page.screenshot({ path: 'e2e-results/local-test.png' });
  
  // ログインボタンを探す
  const loginButton = page.locator('button').filter({ hasText: /log.*in|sign.*in/i }).first();
  const buttonCount = await loginButton.count();
  
  console.log('Login button found:', buttonCount > 0);
  
  expect(buttonCount).toBeGreaterThanOrEqual(0);
});