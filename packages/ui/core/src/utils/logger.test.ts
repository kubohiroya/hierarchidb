import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from './logger';

describe('Logger Utilities', () => {
  // 【テスト前準備】: console メソッドのモック化
  // 【環境初期化】: 各テストで独立したモック状態を保証
  let originalEnv: string | undefined;

  beforeEach(() => {
    // 【テスト前準備】: NODE_ENV の保存とconsoleメソッドのスパイ設定
    // 【環境初期化】: 前のテストの影響を受けないようモックをリセット
    originalEnv = process.env.NODE_ENV;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // 【テスト後処理】: NODE_ENV を元の値に復元
    // 【状態復元】: 次のテストに影響しないようモックをクリア
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  describe('正常系テストケース', () => {
    it('開発環境でカスタムプレフィックス付きログが出力される', () => {
      // 【テスト目的】: createLogger関数で作成したロガーが正しくプレフィックスを付けてログ出力する
      // 【テスト内容】: プレフィックス付きロガーの生成とログ出力
      // 【期待される動作】: console.logが指定プレフィックス付きで呼び出される
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: テスト用のプレフィックスとメッセージを用意
      // 【初期条件設定】: 開発環境を模擬
      process.env.NODE_ENV = 'development';
      const logger = createLogger('TestModule');

      // 【実際の処理実行】: devLog メソッドを呼び出し
      // 【処理内容】: プレフィックス付きでログメッセージを出力
      logger.devLog('Test message');

      // 【結果検証】: console.log が正しい引数で呼ばれたか確認
      // 【期待値確認】: プレフィックスとメッセージが正しく渡されている
      expect(console.log).toHaveBeenCalledWith('[TestModule]', 'Test message'); // 【確認内容】: プレフィックスが正しく付与されているか 🟢
    });

    it('開発環境でエラーログが正しく出力される', () => {
      // 【テスト目的】: devError関数がconsole.errorを適切に呼び出す
      // 【テスト内容】: エラーログの出力と複数引数の処理
      // 【期待される動作】: console.errorが正しいプレフィックスで呼び出される
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: エラーメッセージとエラーオブジェクトを用意
      // 【初期条件設定】: 開発環境でのエラー発生を模擬
      process.env.NODE_ENV = 'development';
      const logger = createLogger('ErrorModule');
      const testError = new Error('Test error');

      // 【実際の処理実行】: devError メソッドを呼び出し
      // 【処理内容】: エラーメッセージとエラーオブジェクトを出力
      logger.devError('Error occurred', testError);

      // 【結果検証】: console.error が正しい引数で呼ばれたか確認
      // 【期待値確認】: エラー情報が欠落なく出力されている
      expect(console.error).toHaveBeenCalledWith(
        '[ErrorModule Error]',
        'Error occurred',
        testError
      ); // 【確認内容】: エラープレフィックスとエラー詳細が正しく渡されているか 🟢
    });

    it('開発環境で警告ログが正しく出力される', () => {
      // 【テスト目的】: devWarn関数がconsole.warnを適切に呼び出す
      // 【テスト内容】: 警告ログの出力
      // 【期待される動作】: console.warnが正しいプレフィックスで呼び出される
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: 警告メッセージを用意
      // 【初期条件設定】: 非推奨機能使用時の警告を模擬
      process.env.NODE_ENV = 'development';
      const logger = createLogger('WarnModule');

      // 【実際の処理実行】: devWarn メソッドを呼び出し
      // 【処理内容】: 警告メッセージを出力
      logger.devWarn('Deprecated function used');

      // 【結果検証】: console.warn が正しい引数で呼ばれたか確認
      // 【期待値確認】: 警告レベルが正しく識別できる
      expect(console.warn).toHaveBeenCalledWith('[WarnModule Warning]', 'Deprecated function used'); // 【確認内容】: 警告プレフィックスが正しく付与されているか 🟢
    });

    it('複数引数が正しく処理される', () => {
      // 【テスト目的】: 可変長引数が正しく処理される
      // 【テスト内容】: 0個から複数個の引数を渡してログ出力
      // 【期待される動作】: 全ての引数が正しく console に渡される
      // 🟢 信頼性レベル: 現在の実装（...args: any[]）から導出

      // 【テストデータ準備】: 様々な型の引数を用意
      // 【初期条件設定】: 開発環境でデバッグ出力を模擬
      process.env.NODE_ENV = 'development';
      const logger = createLogger('MultiArgs');
      const testObj = { obj: 1 };
      const testArray = [1, 2, 3];

      // 【実際の処理実行】: 複数引数でdevLogを呼び出し
      // 【処理内容】: 文字列、オブジェクト、配列を同時に出力
      logger.devLog('multiple', testObj, testArray);

      // 【結果検証】: 全ての引数が正しく渡されているか確認
      // 【期待値確認】: 引数の数と内容が保持されている
      expect(console.log).toHaveBeenCalledWith('[MultiArgs]', 'multiple', testObj, testArray); // 【確認内容】: 可変長引数が全て正しく渡されているか 🟢
    });
  });

  describe('異常系テストケース', () => {
    it('本番環境でログが出力されない', () => {
      // 【テスト目的】: NODE_ENV='production'時にログを抑制
      // 【テスト内容】: 本番環境でのログ出力抑制
      // 【期待される動作】: console メソッドが呼び出されない
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: 本番環境を設定
      // 【初期条件設定】: デプロイ後の本番環境を模擬
      process.env.NODE_ENV = 'production';
      const logger = createLogger('ProdModule');

      // 【実際の処理実行】: 各種ログメソッドを呼び出し
      // 【処理内容】: ログ、エラー、警告を出力試行
      logger.devLog('Should not appear');
      logger.devError('Should not appear');
      logger.devWarn('Should not appear');

      // 【結果検証】: console メソッドが呼ばれていないことを確認
      // 【期待値確認】: 本番環境での情報漏洩防止
      expect(console.log).not.toHaveBeenCalled(); // 【確認内容】: 本番環境でログが抑制されているか 🟢
      expect(console.error).not.toHaveBeenCalled(); // 【確認内容】: 本番環境でエラーログが抑制されているか 🟢
      expect(console.warn).not.toHaveBeenCalled(); // 【確認内容】: 本番環境で警告ログが抑制されているか 🟢
    });

    it('空のプレフィックスでもエラーが発生しない', () => {
      // 【テスト目的】: プレフィックスが空文字列の場合の処理
      // 【テスト内容】: 空文字列プレフィックスでのログ出力
      // 【期待される動作】: エラーなく空のプレフィックスで出力
      // 🟡 信頼性レベル: 妥当な推測

      // 【テストデータ準備】: 空のプレフィックスを設定
      // 【初期条件設定】: 設定ミスや初期化前の状態を模擬
      process.env.NODE_ENV = 'development';
      const logger = createLogger('');

      // 【実際の処理実行】: 空プレフィックスでログ出力
      // 【処理内容】: プレフィックスなしでメッセージを出力
      logger.devLog('Message without prefix');

      // 【結果検証】: 空のプレフィックスでも正常に動作
      // 【期待値確認】: グレースフルな処理継続
      expect(console.log).toHaveBeenCalledWith('[]', 'Message without prefix'); // 【確認内容】: 空プレフィックスでも正常動作するか 🟡
    });

    it('環境変数未設定時は開発環境として動作', () => {
      // 【テスト目的】: NODE_ENV未設定時のデフォルト動作
      // 【テスト内容】: 環境変数がundefinedの場合の動作
      // 【期待される動作】: デフォルトで開発環境として動作
      // 🟡 信頼性レベル: 一般的なNode.jsの慣習に基づく推測

      // 【テストデータ準備】: NODE_ENVを未設定に
      // 【初期条件設定】: ローカル開発環境の初期状態を模擬
      delete process.env.NODE_ENV;
      const logger = createLogger('DefaultEnv');

      // 【実際の処理実行】: 環境変数未設定でログ出力
      // 【処理内容】: デフォルト環境でのログ出力
      logger.devLog('Default environment');

      // 【結果検証】: ログが出力されることを確認（開発環境として動作）
      // 【期待値確認】: 環境設定ミスでも安全な動作
      expect(console.log).toHaveBeenCalledWith('[DefaultEnv]', 'Default environment'); // 【確認内容】: デフォルトが開発環境として動作するか 🟡
    });
  });

  describe('境界値テストケース', () => {
    it('引数なしでログ出力が可能', () => {
      // 【テスト目的】: 引数0個での動作確認
      // 【テスト内容】: 引数なしでdevLogを呼び出し
      // 【期待される動作】: プレフィックスのみが出力される
      // 🟢 信頼性レベル: 現在の実装から導出

      // 【テストデータ準備】: 引数なしの呼び出しを準備
      // 【初期条件設定】: 開発環境を設定
      process.env.NODE_ENV = 'development';
      const logger = createLogger('NoArgs');

      // 【実際の処理実行】: 引数なしでdevLogを呼び出し
      // 【処理内容】: プレフィックスのみを出力
      logger.devLog();

      // 【結果検証】: プレフィックスのみが出力されることを確認
      // 【期待値確認】: 引数なしでもエラーが発生しない
      expect(console.log).toHaveBeenCalledWith('[NoArgs]'); // 【確認内容】: 引数0個でも正常動作するか 🟢
    });

    it('null/undefined/NaNが正しく出力される', () => {
      // 【テスト目的】: JavaScript の特殊値の処理
      // 【テスト内容】: 特殊値をログ出力
      // 【期待される動作】: 特殊値もエラーなく出力
      // 🟡 信頼性レベル: 妥当な推測

      // 【テストデータ準備】: JavaScript の特殊値を用意
      // 【初期条件設定】: エラー時や初期化前の値のデバッグを模擬
      process.env.NODE_ENV = 'development';
      const logger = createLogger('SpecialValues');

      // 【実際の処理実行】: 特殊値でログ出力
      // 【処理内容】: null, undefined, NaNを出力
      logger.devLog(null, undefined, NaN);

      // 【結果検証】: 特殊値が正しく出力されることを確認
      // 【期待値確認】: エラーなく処理継続
      expect(console.log).toHaveBeenCalledWith('[SpecialValues]', null, undefined, NaN); // 【確認内容】: 特殊値も正確にログ出力されるか 🟡
    });

    it('非常に長いプレフィックスでも正常動作', () => {
      // 【テスト目的】: プレフィックスの長さ制限確認
      // 【テスト内容】: 100文字以上のプレフィックスでログ出力
      // 【期待される動作】: 長いプレフィックスでも正常動作
      // 🟡 信頼性レベル: エッジケースとしての妥当な推測

      // 【テストデータ準備】: 非常に長いプレフィックスを生成
      // 【初期条件設定】: 詳細なモジュール名を使用する場合を模擬
      process.env.NODE_ENV = 'development';
      const longPrefix =
        'VeryLongModuleNameForTestingPurposesWithMoreThan100CharactersToCheckIfTheLoggerCanHandleLongPrefixesWithoutAnyIssues';
      const logger = createLogger(longPrefix);

      // 【実際の処理実行】: 長いプレフィックスでログ出力
      // 【処理内容】: 長大なプレフィックス付きメッセージを出力
      logger.devLog('Test with long prefix');

      // 【結果検証】: 長いプレフィックスでも正常に出力
      // 【期待値確認】: プレフィックスの長さ制限なし
      expect(console.log).toHaveBeenCalledWith(`[${longPrefix}]`, 'Test with long prefix'); // 【確認内容】: 長いプレフィックスでも切り詰められないか 🟡
    });
  });
});
