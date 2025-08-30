#!/usr/bin/env tsx
/**
 * @file check-sabotage.ts
 * @description AIによる横着・サボリ設定を検出するスクリプト
 * 
 * 検出する項目:
 * - skipLibCheck: true (ライブラリ型チェックのスキップ)
 * - テストファイルがexcludeされている
 * - @ts-ignoreやany型の過度な使用
 * - strict設定の無効化
 * - noUnusedLocals/noUnusedParametersの無効化
 * - describe.skip, it.skip, test.skipの使用
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface SabotageIssue {
  file: string;
  type: 'config' | 'code' | 'test';
  severity: 'error' | 'warning' | 'info';
  issue: string;
  details?: string;
  line?: number;
}

interface TSConfig {
  compilerOptions?: {
    skipLibCheck?: boolean;
    strict?: boolean;
    noUnusedLocals?: boolean;
    noUnusedParameters?: boolean;
    noImplicitAny?: boolean;
    [key: string]: any;
  };
  exclude?: string[];
  include?: string[];
}

class SabotageChecker {
  private issues: SabotageIssue[] = [];
  private projectRoot: string;
  private packagePaths: string[] = [];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * メイン実行関数
   */
  async run(): Promise<void> {
    console.log('🕵️  AIサボリ検出スクリプトを開始します...\n');

    await this.findPackages();
    await this.checkTSConfigs();
    await this.checkCodeQuality();
    await this.checkTestSkips();

    this.reportResults();
  }

  /**
   * モノレポ内の全パッケージを検索
   */
  private async findPackages(): Promise<void> {
    const packageJsonFiles = await glob('**/package.json', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', '**/node_modules/**', '**/dist/**']
    });

    this.packagePaths = packageJsonFiles
      .map(file => path.dirname(path.resolve(this.projectRoot, file)))
      .filter(dir => dir !== this.projectRoot); // ルートは除外

    console.log(`📦 ${this.packagePaths.length}個のパッケージを発見しました`);
  }

  /**
   * TypeScript設定ファイルをチェック
   */
  private async checkTSConfigs(): Promise<void> {
    console.log('🔍 TypeScript設定をチェック中...');

    for (const packagePath of this.packagePaths) {
      const tsconfigPath = path.join(packagePath, 'tsconfig.json');
      
      if (!fs.existsSync(tsconfigPath)) {
        this.addIssue({
          file: path.relative(this.projectRoot, packagePath),
          type: 'config',
          severity: 'warning',
          issue: 'tsconfig.json not found',
          details: 'TypeScript設定ファイルが見つかりません'
        });
        continue;
      }

      await this.checkTSConfigFile(tsconfigPath);
    }

    // ルートのtsconfig.jsonもチェック
    const rootTsconfig = path.join(this.projectRoot, 'tsconfig.json');
    if (fs.existsSync(rootTsconfig)) {
      await this.checkTSConfigFile(rootTsconfig);
    }
  }

  /**
   * 個別のtsconfig.jsonファイルをチェック
   */
  private async checkTSConfigFile(tsconfigPath: string): Promise<void> {
    try {
      const content = fs.readFileSync(tsconfigPath, 'utf-8');
      const config: TSConfig = JSON.parse(content);
      const relativePath = path.relative(this.projectRoot, tsconfigPath);

      // skipLibCheck: trueをチェック
      if (config.compilerOptions?.skipLibCheck === true) {
        this.addIssue({
          file: relativePath,
          type: 'config',
          severity: 'error',
          issue: 'skipLibCheck: true detected',
          details: 'ライブラリの型チェックがスキップされています。これは型安全性を損なう可能性があります。'
        });
      }

      // strict設定の確認
      if (config.compilerOptions?.strict === false) {
        this.addIssue({
          file: relativePath,
          type: 'config',
          severity: 'error',
          issue: 'strict: false detected',
          details: 'strictモードが無効化されています。型安全性が大幅に低下します。'
        });
      }

      // noUnusedLocals/noUnusedParametersの確認
      if (config.compilerOptions?.noUnusedLocals === false) {
        this.addIssue({
          file: relativePath,
          type: 'config',
          severity: 'warning',
          issue: 'noUnusedLocals: false detected',
          details: '未使用のローカル変数検出が無効化されています。'
        });
      }

      if (config.compilerOptions?.noUnusedParameters === false) {
        this.addIssue({
          file: relativePath,
          type: 'config',
          severity: 'warning',
          issue: 'noUnusedParameters: false detected',
          details: '未使用のパラメータ検出が無効化されています。'
        });
      }

      // テストファイルのexcludeをチェック
      if (config.exclude) {
        const testExclusions = config.exclude.filter(pattern => 
          pattern.includes('test') || 
          pattern.includes('spec') || 
          pattern.includes('__tests__')
        );

        if (testExclusions.length > 0) {
          this.addIssue({
            file: relativePath,
            type: 'config',
            severity: 'warning',
            issue: 'Test files excluded from compilation',
            details: `テストファイルが除外されています: ${testExclusions.join(', ')}`
          });
        }
      }

      // noImplicitAnyの確認
      if (config.compilerOptions?.noImplicitAny === false) {
        this.addIssue({
          file: relativePath,
          type: 'config',
          severity: 'error',
          issue: 'noImplicitAny: false detected',
          details: 'implicit any型の使用が許可されています。型安全性が損なわれます。'
        });
      }

    } catch (error) {
      this.addIssue({
        file: path.relative(this.projectRoot, tsconfigPath),
        type: 'config',
        severity: 'error',
        issue: 'Invalid JSON in tsconfig.json',
        details: `JSON解析エラー: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * コード品質をチェック
   */
  private async checkCodeQuality(): Promise<void> {
    console.log('📝 コード品質をチェック中...');

    const codeFiles = await glob('**/*.{ts,tsx}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', '**/node_modules/**', '**/dist/**', '**/*.d.ts']
    });

    for (const file of codeFiles) {
      await this.checkCodeFile(path.resolve(this.projectRoot, file));
    }
  }

  /**
   * 個別のコードファイルをチェック
   */
  private async checkCodeFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(this.projectRoot, filePath);

      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        
        // @ts-ignoreの検出
        if (line.includes('@ts-ignore')) {
          this.addIssue({
            file: relativePath,
            type: 'code',
            severity: 'warning',
            issue: '@ts-ignore found',
            details: 'TypeScriptエラーが無視されています。',
            line: lineNumber
          });
        }

        // @ts-nocheck の検出
        if (line.includes('@ts-nocheck')) {
          this.addIssue({
            file: relativePath,
            type: 'code',
            severity: 'error',
            issue: '@ts-nocheck found',
            details: 'ファイル全体の型チェックが無効化されています。',
            line: lineNumber
          });
        }

        // eslint-disable の過度な使用
        if (line.includes('eslint-disable')) {
          this.addIssue({
            file: relativePath,
            type: 'code',
            severity: 'info',
            issue: 'eslint-disable found',
            details: 'ESLintルールが無効化されています。',
            line: lineNumber
          });
        }

        // any型の過度な使用（型注釈として使用されている場合）
        const anyTypeRegex = /:\s*any(\s|$|,|\||\&)/;
        if (anyTypeRegex.test(line)) {
          this.addIssue({
            file: relativePath,
            type: 'code',
            severity: 'warning',
            issue: 'any type annotation found',
            details: 'any型が明示的に使用されています。',
            line: lineNumber
          });
        }
      });

      // any型の使用回数をカウント
      const anyCount = (content.match(/:\s*any(\s|$|,|\||\&)/g) || []).length;
      if (anyCount > 5) {
        this.addIssue({
          file: relativePath,
          type: 'code',
          severity: 'warning',
          issue: 'Excessive any type usage',
          details: `any型が${anyCount}回使用されています。型安全性を検討してください。`
        });
      }

    } catch (error) {
      // ファイル読み込みエラーは無視（バイナリファイルなど）
    }
  }

  /**
   * テストのスキップをチェック
   */
  private async checkTestSkips(): Promise<void> {
    console.log('🧪 テストスキップをチェック中...');

    const testFiles = await glob('**/*.{test,spec}.{ts,tsx,js,jsx}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', '**/node_modules/**', '**/dist/**']
    });

    for (const file of testFiles) {
      await this.checkTestFile(path.resolve(this.projectRoot, file));
    }
  }

  /**
   * 個別のテストファイルをチェック
   */
  private async checkTestFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(this.projectRoot, filePath);

      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        
        // describe.skip, it.skip, test.skipの検出
        if (line.includes('describe.skip') || line.includes('context.skip')) {
          this.addIssue({
            file: relativePath,
            type: 'test',
            severity: 'warning',
            issue: 'describe.skip found',
            details: 'テストスイートがスキップされています。',
            line: lineNumber
          });
        }

        if (line.includes('it.skip') || line.includes('test.skip')) {
          this.addIssue({
            file: relativePath,
            type: 'test',
            severity: 'warning',
            issue: 'test skip found',
            details: '個別のテストがスキップされています。',
            line: lineNumber
          });
        }

        // .todo() の検出（Jest）
        if (line.includes('.todo(')) {
          this.addIssue({
            file: relativePath,
            type: 'test',
            severity: 'info',
            issue: 'test.todo found',
            details: 'TODOテストが見つかりました。実装を検討してください。',
            line: lineNumber
          });
        }
      });

    } catch (error) {
      // ファイル読み込みエラーは無視
    }
  }

  /**
   * 問題を追加
   */
  private addIssue(issue: SabotageIssue): void {
    this.issues.push(issue);
  }

  /**
   * 結果を報告
   */
  private reportResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 AIサボリ検出結果');
    console.log('='.repeat(60));

    if (this.issues.length === 0) {
      console.log('✅ サボリは検出されませんでした！素晴らしいコード品質です。');
      return;
    }

    // 重要度別に集計
    const errors = this.issues.filter(i => i.severity === 'error');
    const warnings = this.issues.filter(i => i.severity === 'warning');
    const info = this.issues.filter(i => i.severity === 'info');

    console.log(`\n📊 サマリー:`);
    console.log(`  🔴 エラー: ${errors.length}件`);
    console.log(`  🟡 警告: ${warnings.length}件`);
    console.log(`  🔵 情報: ${info.length}件`);
    console.log(`  📝 合計: ${this.issues.length}件\n`);

    // タイプ別に分類して表示
    const byType = {
      config: this.issues.filter(i => i.type === 'config'),
      code: this.issues.filter(i => i.type === 'code'),
      test: this.issues.filter(i => i.type === 'test')
    };

    if (byType.config.length > 0) {
      console.log('🔧 設定ファイルの問題:');
      this.printIssues(byType.config);
    }

    if (byType.code.length > 0) {
      console.log('\n📝 コードの問題:');
      this.printIssues(byType.code);
    }

    if (byType.test.length > 0) {
      console.log('\n🧪 テストの問題:');
      this.printIssues(byType.test);
    }

    console.log('\n' + '='.repeat(60));
    console.log('💡 推奨アクション:');
    console.log('1. skipLibCheck: true を削除してライブラリ型チェックを有効化');
    console.log('2. strict: false を削除してstrictモードを有効化');
    console.log('3. @ts-ignore を適切な型定義に置き換え');
    console.log('4. スキップされたテストを実装または削除');
    console.log('5. any型を具体的な型に置き換え');
    console.log('='.repeat(60));

    // 終了コード
    process.exit(errors.length > 0 ? 1 : 0);
  }

  /**
   * 問題リストを表示
   */
  private printIssues(issues: SabotageIssue[]): void {
    issues.forEach(issue => {
      const icon = issue.severity === 'error' ? '🔴' : 
                   issue.severity === 'warning' ? '🟡' : '🔵';
      const line = issue.line ? `:${issue.line}` : '';
      
      console.log(`  ${icon} ${issue.file}${line}`);
      console.log(`     ${issue.issue}`);
      if (issue.details) {
        console.log(`     ${issue.details}`);
      }
      console.log('');
    });
  }
}

// メイン実行
async function main(): Promise<void> {
  try {
    const checker = new SabotageChecker();
    await checker.run();
  } catch (error) {
    console.error('❌ スクリプトの実行中にエラーが発生しました:');
    console.error(error);
    process.exit(1);
  }
}

// ES modulesでは import.meta.url を使用
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { SabotageChecker };