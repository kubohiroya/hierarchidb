/**
 * 【機能概要】: 開発環境でのみ動作するログユーティリティ
 * 【改善内容】: パフォーマンス最適化と型安全性の向上
 * 【設計方針】: 環境変数チェックの最適化、本番環境での完全無効化
 * 【パフォーマンス】: 初期化時の環境判定で実行時オーバーヘッドを削減
 * 【保守性】: 型定義の改善と定数の外部化により保守しやすく
 * 🟢 信頼性レベル: テスト要件とベストプラクティスから導出
 */

/**
 * 【設定定数】: ログプレフィックスのフォーマット設定
 * 【調整可能性】: 将来的にフォーマットを変更する場合はここを修正
 * 🟡 信頼性レベル: 一般的なログフォーマットパターン
 */
const LOG_PREFIX_FORMAT = {
  normal: (prefix: string) => `[${prefix}]`,
  error: (prefix: string) => `[${prefix} Error]`,
  warning: (prefix: string) => `[${prefix} Warning]`,
} as const;

/**
 * 【型定義】: ログメソッドの引数型
 * 【改善内容】: any[]からより適切な型へ変更
 * 【型安全性】: 基本的なJavaScript型を受け入れる
 * 🟡 信頼性レベル: TypeScriptのベストプラクティス
 */
type LogArgs = (string | number | boolean | object | null | undefined)[];

/**
 * 【インターフェース定義】: ロガーオブジェクトの型定義
 * 【改善内容】: 引数型をLogArgsに改善
 * 【設計意図】: devLog, devError, devWarn の3つのメソッドを提供
 * 🟢 信頼性レベル: テスト要件から直接導出
 */
export interface Logger {
  devLog: (...args: LogArgs) => void;
  devError: (...args: LogArgs) => void;
  devWarn: (...args: LogArgs) => void;
}

/**
 * 【ヘルパー関数】: 空関数（no-op）の生成
 * 【再利用性】: 本番環境での無効化に使用
 * 【単一責任】: 何もしない関数を返すだけの責任
 * 🟡 信頼性レベル: パフォーマンス最適化のベストプラクティス
 */
const createNoOpFunction = (): ((...args: LogArgs) => void) => {
  // 【処理効率化】: 本番環境では何も実行しない関数を返す
  // 【可読性向上】: 明示的にno-op関数であることを示す
  return () => { /* no-op */ };
};

/**
 * 【機能概要】: プレフィックス付きロガーを生成する関数
 * 【改善内容】: 環境判定を初期化時に1回のみ実行、本番環境での完全無効化
 * 【設計方針】: パフォーマンスを重視した条件分岐の最適化
 * 【パフォーマンス】: 実行時の環境変数チェックを排除
 * 【保守性】: プレフィックスフォーマットを定数化
 * 🟢 信頼性レベル: テスト要件から直接導出
 * @param prefix - ログメッセージに付与するプレフィックス
 * @returns Logger - 3つのログメソッドを持つオブジェクト
 */
export function createLogger(prefix: string): Logger {
  // 【環境判定最適化】: 初期化時に1回だけ環境を判定
  // 【パフォーマンス向上】: 各ログ出力時の判定を排除
  // 🟢 信頼性レベル: テストケースから直接導出
  const isDev = process.env.NODE_ENV !== 'production';
  
  // 【本番環境最適化】: 本番環境では空関数を返して完全無効化
  // 【セキュリティ強化】: 本番環境でのログ出力を確実に防止
  if (!isDev) {
    return {
      devLog: createNoOpFunction(),
      devError: createNoOpFunction(),
      devWarn: createNoOpFunction(),
    };
  }

  // 【プレフィックス事前生成】: 繰り返し使用される文字列を事前に生成
  // 【メモリ効率化】: 文字列の重複生成を防ぐ
  const normalPrefix = LOG_PREFIX_FORMAT.normal(prefix);
  const errorPrefix = LOG_PREFIX_FORMAT.error(prefix);
  const warningPrefix = LOG_PREFIX_FORMAT.warning(prefix);

  return {
    /**
     * 【通常ログ出力】: 開発環境でのみプレフィックス付きでログ出力
     * 【最適化済み】: 環境チェックを削除、事前生成プレフィックスを使用
     * 🟢 信頼性レベル: テスト要件から直接導出
     */
    devLog: (...args: LogArgs) => {
      // 【直接出力】: 環境チェック不要（初期化時に判定済み）
      // 【パフォーマンス】: 条件分岐を削除して高速化
      console.log(normalPrefix, ...args);
    },

    /**
     * 【エラーログ出力】: 開発環境でのみエラーログを出力
     * 【最適化済み】: 環境チェックを削除、事前生成プレフィックスを使用
     * 🟢 信頼性レベル: テスト要件から直接導出
     */
    devError: (...args: LogArgs) => {
      // 【直接出力】: 環境チェック不要（初期化時に判定済み）
      // 【エラー追跡】: スタックトレース情報を保持
      console.error(errorPrefix, ...args);
    },

    /**
     * 【警告ログ出力】: 開発環境でのみ警告ログを出力
     * 【最適化済み】: 環境チェックを削除、事前生成プレフィックスを使用
     * 🟢 信頼性レベル: テスト要件から直接導出
     */
    devWarn: (...args: LogArgs) => {
      // 【直接出力】: 環境チェック不要（初期化時に判定済み）
      // 【警告追跡】: 警告の発生箇所を追跡可能
      console.warn(warningPrefix, ...args);
    }
  };
}

/**
 * 【互換性レイヤー】: 既存コードとの互換性のため個別関数もエクスポート
 * 【改善内容】: 最適化されたデフォルトロガーインスタンスを使用
 * 【移行支援】: 段階的な移行を可能にする設計
 * 【保守性】: 将来的な廃止予定の明記とガイダンス提供
 * 🟡 信頼性レベル: リファクタリング要件から推測
 */

// 【デフォルトロガー最適化】: 空プレフィックスでロガーインスタンスを生成
// 【キャッシュ効果】: 繰り返し使用されるインスタンスをキャッシュ
const defaultLogger = createLogger('');

/**
 * 【後方互換性関数】: 既存の ui-file, ui-monitoring との互換性維持
 * 【段階的移行】: 新しいコードでは createLogger を使用推奨
 * 【非推奨予定】: 将来のバージョンで削除予定（移行期間中は維持）
 * 🟡 信頼性レベル: リファクタリング要件とAPIデザインから推測
 */
export const devLog = defaultLogger.devLog;
export const devError = defaultLogger.devError;
export const devWarn = defaultLogger.devWarn;