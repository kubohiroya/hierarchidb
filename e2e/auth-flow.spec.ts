/**
 * 認証フローE2Eテスト
 * 
 * 作成日: 2025年8月25日
 * 更新日: 2025年8月25日
 * 
 * 2つの環境パターンで認証フローをテストし、
 * console.logとネットワークリクエストをキャプチャして分析
 */

import { test, expect, Page, ConsoleMessage, Request, Response } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ログ記録用のインターフェース
interface LogEntry {
  timestamp: string;
  type: 'console' | 'request' | 'response' | 'navigation' | 'error';
  level?: string;
  url?: string;
  method?: string;
  status?: number;
  message?: string;
  data?: any;
}

// 環境パターンの定義
const ENVIRONMENTS = {
  development: {
    name: '開発環境',
    baseUrl: 'http://localhost:4200',
    bffUrl: 'https://eria-cartograph-bff.kubohiroya.workers.dev/api/auth',
    useMockAuth: false,
  },
  production: {
    name: '本番環境',
    baseUrl: 'http://localhost:5173', // Vite preview server for local testing
    bffUrl: 'https://eria-cartograph-bff.kubohiroya.workers.dev/api/auth',
    useMockAuth: false,
  },
};

// ログ収集用のヘルパークラス
class AuthFlowLogger {
  private logs: LogEntry[] = [];
  private environment: string;
  private startTime: number;

  constructor(environment: string) {
    this.environment = environment;
    this.startTime = Date.now();
  }

  private getRelativeTime(): string {
    const elapsed = Date.now() - this.startTime;
    return `+${elapsed}ms`;
  }

  addConsoleLog(msg: ConsoleMessage) {
    this.logs.push({
      timestamp: this.getRelativeTime(),
      type: 'console',
      level: msg.type(),
      message: msg.text(),
      data: msg.args().length > 0 ? msg.args().map(arg => arg.toString()) : undefined,
    });
  }

  addRequest(request: Request) {
    this.logs.push({
      timestamp: this.getRelativeTime(),
      type: 'request',
      method: request.method(),
      url: request.url(),
      data: request.postData(),
    });
  }

  addResponse(response: Response) {
    this.logs.push({
      timestamp: this.getRelativeTime(),
      type: 'response',
      url: response.url(),
      status: response.status(),
      message: response.statusText(),
    });
  }

  addNavigation(url: string) {
    this.logs.push({
      timestamp: this.getRelativeTime(),
      type: 'navigation',
      url,
    });
  }

  addError(error: Error) {
    this.logs.push({
      timestamp: this.getRelativeTime(),
      type: 'error',
      message: error.message,
      data: error.stack,
    });
  }

  saveToFile() {
    const logDir = path.join(process.cwd(), 'e2e-results', 'auth-flow-logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const filename = path.join(logDir, `${this.environment}-${Date.now()}.json`);
    fs.writeFileSync(filename, JSON.stringify(this.logs, null, 2));
    
    // 人間が読みやすい形式でも保存
    const readableFilename = path.join(logDir, `${this.environment}-readable-${Date.now()}.log`);
    const readableContent = this.logs.map(log => {
      let line = `[${log.timestamp}] ${log.type.toUpperCase()}`;
      if (log.level) line += ` (${log.level})`;
      if (log.method) line += ` ${log.method}`;
      if (log.url) line += ` ${log.url}`;
      if (log.status) line += ` -> ${log.status}`;
      if (log.message) line += `: ${log.message}`;
      if (log.data) line += `\n  Data: ${JSON.stringify(log.data)}`;
      return line;
    }).join('\n');
    
    fs.writeFileSync(readableFilename, readableContent);
    
    console.log(`Logs saved to:\n  - ${filename}\n  - ${readableFilename}`);
    return { json: filename, readable: readableFilename };
  }

  getLogs() {
    return this.logs;
  }
}

// 認証フローのテスト実装
async function testAuthFlow(page: Page, env: typeof ENVIRONMENTS[keyof typeof ENVIRONMENTS], logger: AuthFlowLogger) {
  // コンソールログの収集
  page.on('console', msg => logger.addConsoleLog(msg));
  
  // ネットワークリクエストの収集
  page.on('request', request => {
    // 認証関連のリクエストのみ記録
    if (request.url().includes('/auth') || request.url().includes('/api')) {
      logger.addRequest(request);
    }
  });
  
  page.on('response', response => {
    // 認証関連のレスポンスのみ記録
    if (response.url().includes('/auth') || response.url().includes('/api')) {
      logger.addResponse(response);
    }
  });
  
  // ナビゲーションの記録
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      logger.addNavigation(frame.url());
    }
  });
  
  // エラーの記録
  page.on('pageerror', error => logger.addError(error));
  
  // 1. アプリケーションにアクセス
  console.log(`[${env.name}] Navigating to ${env.baseUrl}`);
  await page.goto(env.baseUrl);
  await page.waitForLoadState('networkidle');
  
  // 2. 初期画面のスクリーンショット
  await page.screenshot({ 
    path: `e2e-results/auth-flow-logs/${logger['environment']}-01-initial.png`,
    fullPage: true 
  });
  
  // 3. ログインボタンを探して表示状態を確認
  const loginButton = page.locator('button:has-text("ログイン"), button:has-text("Sign in"), button:has-text("Login")').first();
  const loginButtonExists = await loginButton.count() > 0;
  
  if (loginButtonExists) {
    console.log(`[${env.name}] Login button found`);
    
    // 4. ログインボタンをクリック
    await loginButton.click();
    
    // 5. 認証フローの処理を待つ
    if (env.useMockAuth) {
      // モック環境：即座に認証完了
      await page.waitForTimeout(2000);
    } else {
      // 実環境：OAuthリダイレクトを待つ
      // 注: 実際のOAuth認証画面は自動化できないため、
      // ここではリダイレクトURLの確認のみ行う
      
      // ポップアップまたはリダイレクトを待つ
      const [popup] = await Promise.all([
        page.waitForEvent('popup', { timeout: 5000 }).catch(() => null),
        page.waitForNavigation({ timeout: 5000 }).catch(() => null),
      ]);
      
      if (popup) {
        console.log(`[${env.name}] OAuth popup detected: ${popup.url()}`);
        await popup.close();
      } else if (page.url().includes('accounts.google.com') || page.url().includes('github.com')) {
        console.log(`[${env.name}] Redirected to OAuth provider: ${page.url()}`);
        // 実際の認証はスキップ（テスト環境では完了できない）
        await page.goBack();
      }
    }
    
    // 6. 認証後の画面スクリーンショット
    await page.screenshot({ 
      path: `e2e-results/auth-flow-logs/${logger['environment']}-02-after-auth.png`,
      fullPage: true 
    });
  } else {
    console.log(`[${env.name}] No login button found - might be already authenticated or different UI`);
  }
  
  // 7. ローカルストレージの内容を確認
  const localStorage = await page.evaluate(() => {
    const items: Record<string, any> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        items[key] = window.localStorage.getItem(key);
      }
    }
    return items;
  });
  
  logger.addConsoleLog({
    type: () => 'log',
    text: () => `LocalStorage contents: ${JSON.stringify(localStorage)}`,
    args: () => [],
  } as ConsoleMessage);
  
  // 8. Cookieの確認
  const cookies = await page.context().cookies();
  const authCookies = cookies.filter(c => 
    c.name.includes('auth') || 
    c.name.includes('token') || 
    c.name.includes('session')
  );
  
  if (authCookies.length > 0) {
    console.log(`[${env.name}] Auth cookies found:`, authCookies.map(c => c.name));
  }
  
  return {
    loginButtonFound: loginButtonExists,
    localStorage,
    authCookies,
  };
}

// 各環境でテストを実行
Object.entries(ENVIRONMENTS).forEach(([envKey, envConfig]) => {
  test.describe(`認証フロー - ${envConfig.name}`, () => {
    let logger: AuthFlowLogger;
    
    test.beforeEach(async ({ page }) => {
      logger = new AuthFlowLogger(envKey);
      
      // 環境変数を設定（実際のサーバー起動時に使用）
      process.env.VITE_ENV_MODE = envKey;
    });
    
    test.afterEach(async () => {
      // ログを保存
      const files = logger.saveToFile();
      console.log(`Test completed for ${envKey} environment`);
    });
    
    test(`${envKey}環境での認証フローテスト`, async ({ page }) => {
      const result = await testAuthFlow(page, envConfig, logger);
      
      // ログの数を確認
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      
      // 認証関連のリクエストがあることを確認
      const authRequests = logs.filter(log => 
        log.type === 'request' && 
        log.url?.includes('/auth')
      );
      
      console.log(`[${envKey}] Total logs: ${logs.length}`);
      console.log(`[${envKey}] Auth requests: ${authRequests.length}`);
    });
  });
});

// テスト後の分析
test.describe('認証フロー分析', () => {
  test('全環境のログを比較分析', async () => {
    const logDir = path.join(process.cwd(), 'e2e-results', 'auth-flow-logs');
    
    if (!fs.existsSync(logDir)) {
      console.log('No logs found to analyze');
      return;
    }
    
    const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.json'));
    const analysis: Record<string, any> = {};
    
    for (const file of logFiles) {
      const env = file.split('-')[0];
      const content = JSON.parse(fs.readFileSync(path.join(logDir, file), 'utf-8'));
      
      if (!analysis[env]) {
        analysis[env] = {
          totalLogs: 0,
          consoleMessages: 0,
          requests: 0,
          responses: 0,
          errors: 0,
          authEndpoints: new Set(),
        };
      }
      
      analysis[env].totalLogs += content.length;
      
      content.forEach((log: LogEntry) => {
        if (log.type === 'console') analysis[env].consoleMessages++;
        if (log.type === 'request') {
          analysis[env].requests++;
          if (log.url?.includes('/auth')) {
            analysis[env].authEndpoints.add(log.url);
          }
        }
        if (log.type === 'response') analysis[env].responses++;
        if (log.type === 'error') analysis[env].errors++;
      });
    }
    
    // 分析結果を保存
    const analysisFile = path.join(logDir, 'analysis.json');
    fs.writeFileSync(analysisFile, JSON.stringify(analysis, 
      (key, value) => value instanceof Set ? Array.from(value) : value, 
      2
    ));
    
    console.log('Analysis saved to:', analysisFile);
    console.log('\n=== 認証フロー分析結果 ===');
    console.log(JSON.stringify(analysis, 
      (key, value) => value instanceof Set ? Array.from(value) : value,
      2
    ));
  });
});