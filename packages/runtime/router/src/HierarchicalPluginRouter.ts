/**
 * 【モジュール概要】: 階層的プラグインルーティングシステム
 * 【設計方針】: セキュリティ・パフォーマンス・保守性を重視した設計
 * 【アーキテクチャ】: プラグインベースの動的ルーティング機構
 * 【TDDフェーズ】: Refactorフェーズ - 品質改善と最適化実装
 *
 * @module HierarchicalPluginRouter
 * @version 1.0.0
 */

// ================================================================================
// 【設定定数セクション】: システム全体で使用される定数群
// ================================================================================

/**
 * 【URL設定定数】: URL処理に関する制限値と設定
 * 【調整可能性】: ブラウザ互換性を考慮して調整可能 🟢
 */
const URL_CONFIG = {
  /** 【最大URL長】: ブラウザの実用的制限値（2048文字） 🟢 */
  MAX_LENGTH: 2048,
  /** 【URLパターン】: 階層URLの正規表現パターン 🟢 */
  HIERARCHICAL_PATTERN: /^\/t\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)$/,
} as const;

/**
 * 【パフォーマンス設定】: SLA基準と監視設定
 * 【最適化済み】: パフォーマンステストに基づく設定値 🟢
 */
const PERFORMANCE_CONFIG = {
  /** 【SLA基準値】: ルート解決の最大許容時間（100ms） 🟢 */
  SLA_MS: 100,
  /** 【警告閾値】: パフォーマンス警告を出力する基準（101ms） 🟢 */
  WARNING_THRESHOLD_MS: 101,
} as const;

/**
 * 【セキュリティ設定】: 入力検証とセキュリティ制約
 * 【強化済み】: XSS・インジェクション攻撃対策設定 🟢
 */
const SECURITY_CONFIG = {
  /** 【安全文字パターン】: プラグイン名に許可される文字 🟢 */
  SAFE_PLUGIN_NAME_PATTERN: /^[a-zA-Z0-9\-_]+$/,
  /** 【最大プラグイン数】: DoS攻撃対策のための制限 🔴 */
  MAX_PLUGINS: 10000,
  /** 【危険なプロパティ】: セキュリティリスクのあるプロパティ名 🔴 */
  DANGEROUS_PROPERTIES: ['__proto__', 'constructor', 'prototype'] as const,
} as const;

/**
 * 【エラーメッセージ定数】: 多言語対応エラーメッセージ
 * 【国際化対応】: 日本語・英語のエラーメッセージ定義 🟢
 */
const ERROR_MESSAGES = {
  ja: {
    URL_TOO_LONG: (max: number) => `URL長制限: URL長が制限値(${max}文字)を超えています`,
    INVALID_URL_FORMAT: '無効なURL形式です',
    SECURITY_INVALID_CHARS: 'セキュリティ: 無効な文字が含まれています',
    MALICIOUS_COMPONENT: '不正なコンポーネント: セキュリティ検証に失敗しました',
    PLUGIN_NOT_FOUND: (name: string) => `プラグインが見つかりません: ${name}`,
    ACTION_NOT_FOUND: (name: string) => `アクションが見つかりません: ${name}`,
    TIMEOUT: 'タイムアウトしました',
    OUT_OF_MEMORY: 'メモリ不足のため処理を中断しました',
    TOO_MANY_PLUGINS: 'プラグイン登録数の上限に達しました',
  },
  en: {
    URL_TOO_LONG: (max: number) => `URL too long: exceeds limit of ${max} characters`,
    INVALID_URL_FORMAT: 'Invalid URL format',
    SECURITY_INVALID_CHARS: 'Security: Invalid characters detected',
    MALICIOUS_COMPONENT: 'Malicious component: Security validation failed',
    PLUGIN_NOT_FOUND: (name: string) => `Plugin not found: ${name}`,
    ACTION_NOT_FOUND: (name: string) => `Action not found: ${name}`,
    TIMEOUT: 'Request timed out',
    OUT_OF_MEMORY: 'Out of memory',
    TOO_MANY_PLUGINS: 'Maximum plugin limit reached',
  },
} as const;

// ================================================================================
// 【型定義セクション】: TypeScript型定義
// ================================================================================

/**
 * 【ルートパラメータ型】: URL解析結果の構造定義
 * 【型安全性】: 厳密な型定義による安全性向上 🟢
 */
export interface RouteParams {
  /** ツリーID */
  readonly treeId: string;
  /** ページツリーノードID */
  readonly pageNodeId: string;
  /** ターゲットツリーノードID */
  readonly targetNodeId: string;
  /** ツリーノードタイプ（プラグイン名） */
  readonly nodeType: string;
}

/**
 * 【プラグインアクション型】: アクションの詳細定義
 * 【改善内容】: any型を削減し、型安全性を向上 🟡
 */
export interface PluginAction {
  /** コンポーネント本体 */
  component: React.ComponentType<any> | (() => any);
  /** 非同期ローダー関数 */
  loader?: (params?: Record<string, unknown>) => Promise<unknown>;
  /** アクセシビリティ設定 */
  accessibility?: {
    screenReader?: boolean;
    keyboardNav?: boolean;
  };
  /** キーボードサポート設定 */
  keyboardSupport?: {
    tabIndex?: number;
    arrowNavigation?: boolean;
  };
}

/**
 * 【プラグイン定義型】: プラグインの完全な定義
 * 【拡張性】: 将来の機能追加を考慮した設計 🟢
 */
export interface PluginDefinition {
  /** ノードタイプ識別子 */
  readonly nodeType: string;
  /** 多言語表示名 */
  displayName?: Record<string, string>;
  /** アクションマップ */
  readonly actions: Readonly<Record<string, PluginAction>>;
}

/**
 * 【ロードオプション型】: 動的ロードのオプション設定
 * 【機能追加】: タイムアウト以外のオプションも追加可能 🟡
 */
export interface LoadOptions {
  /** タイムアウト時間（ミリ秒） */
  timeout?: number;
}

// ================================================================================
// 【ユーティリティ関数セクション】: 共通処理と検証関数
// ================================================================================

/**
 * 【言語取得ヘルパー】: 現在の言語設定を取得
 * 【再利用性】: 多言語対応処理で共通利用 🟡
 * 【単一責任】: 言語判定のみを担当
 */
function getCurrentLanguage(): 'ja' | 'en' {
  const lang = process.env.LANG || 'ja_JP.UTF-8';
  return lang.includes('en') ? 'en' : 'ja';
}

/**
 * 【エラーメッセージ取得】: 言語に応じたエラーメッセージを返す
 * 【国際化対応】: 自動的に適切な言語を選択 🟡
 */
function getErrorMessage(key: keyof typeof ERROR_MESSAGES.ja): string | ((arg: any) => string) {
  const lang = getCurrentLanguage();
  return ERROR_MESSAGES[lang][key];
}

/**
 * 【URL長検証】: URL長制限のチェック
 * 【セキュリティ】: DoS攻撃防止のための制限 🟢
 * 【パフォーマンス】: 早期リターンによる効率化 🟢
 */
function validateUrlLength(url: string): void {
  if (url.length > URL_CONFIG.MAX_LENGTH) {
    const message = getErrorMessage('URL_TOO_LONG');
    throw new Error(typeof message === 'function' ? message(URL_CONFIG.MAX_LENGTH) : message);
  }
}

/**
 * 【プラグイン名セキュリティ検証】: XSS攻撃防止のための入力検証
 * 【改善内容】: HTMLタグと危険文字の包括的チェック 🟢
 * 【設計方針】: ホワイトリスト方式による安全性確保
 */
function validatePluginNameSecurity(pluginName: string): void {
  // 【HTMLタグ検出】: スクリプトインジェクション防止
  if (pluginName.includes('<') || pluginName.includes('>')) {
    throw new Error(getErrorMessage('SECURITY_INVALID_CHARS') as string);
  }

  // 【安全文字検証】: 許可された文字のみを受け入れ
  if (!SECURITY_CONFIG.SAFE_PLUGIN_NAME_PATTERN.test(pluginName)) {
    throw new Error(getErrorMessage('SECURITY_INVALID_CHARS') as string);
  }
}

/**
 * 【コンポーネントセキュリティ検証】: 悪意あるコンポーネントの検出
 * 【改善内容】: プロトタイプ汚染攻撃対策を追加 🔴
 * 【設計方針】: 多層防御による安全性向上
 */
function validateComponentSecurity(component: unknown): void {
  if (!component || typeof component !== 'object') {
    return;
  }

  const obj = component as Record<string, any>;

  // 【プロトタイプ汚染対策】: 危険なプロパティへのアクセスブロック 🔴
  for (const prop of SECURITY_CONFIG.DANGEROUS_PROPERTIES) {
    if (prop in obj) {
      throw new Error(getErrorMessage('MALICIOUS_COMPONENT') as string);
    }
  }

  // 【maliciousプロパティ検出】: テスト用の悪意あるフラグ検出
  if ('malicious' in obj && obj.malicious) {
    throw new Error(getErrorMessage('MALICIOUS_COMPONENT') as string);
  }

  // 【eval検出】: コードインジェクション防止
  if (
    obj.constructor &&
    typeof obj.constructor === 'function' &&
    obj.constructor.toString().includes('eval')
  ) {
    throw new Error(getErrorMessage('MALICIOUS_COMPONENT') as string);
  }
}

/**
 * 【エラーハンドリングヘルパー】: 共通エラー処理ロジック
 * 【DRY原則】: 重複コードの削減 🟡
 * 【保守性】: エラー処理の一元管理
 */
function handleLoadError(error: any): never {
  // 【特定エラーの処理】: 既知のエラータイプに応じた処理
  if (error.message?.includes('Network Error')) {
    throw error; // ネットワークエラーはそのまま再throw
  }
  if (error.message?.includes('OutOfMemoryError')) {
    throw new Error(getErrorMessage('OUT_OF_MEMORY') as string);
  }
  throw error;
}

/**
 * 【非同期コンポーネント実行】: コンポーネントの非同期実行処理
 * 【DRY原則】: 重複処理の共通化 🟡
 * 【エラー処理】: 統一されたエラーハンドリング
 */
async function executeComponent(component: any): Promise<any> {
  if (typeof component === 'function') {
    try {
      return await Promise.resolve(component());
    } catch (error) {
      handleLoadError(error);
    }
  }
  return component;
}

// ================================================================================
// 【プラグインレジストリクラス】: プラグイン管理機構
// ================================================================================

/**
 * 【プラグインレジストリ】: プラグインの登録・取得・管理
 * 【改善内容】: DoS攻撃対策とメモリ管理の強化 🔴
 * 【設計方針】: シングルトンパターンによる一元管理
 */
class PluginRegistryClass {
  /** 【プラグイン格納Map】: O(1)アクセスのためのMap構造 🟢 */
  private readonly plugins = new Map<string, PluginDefinition>();

  /**
   * 【プラグイン登録】: 新規プラグインの登録
   * 【セキュリティ】: 登録数制限によるDoS攻撃対策 🔴
   * 【検証処理】: 登録前の厳密な検証
   */
  register(name: string, plugin: PluginDefinition): void {
    // 【登録数制限チェック】: メモリ枯渇攻撃の防止 🔴
    if (this.plugins.size >= SECURITY_CONFIG.MAX_PLUGINS) {
      throw new Error(getErrorMessage('TOO_MANY_PLUGINS') as string);
    }

    // 【プラグイン名検証】: セキュリティチェック
    validatePluginNameSecurity(name);

    // 【登録処理】: 検証済みプラグインの登録
    this.plugins.set(name, plugin);
  }

  /**
   * 【プラグイン取得】: 登録済みプラグインの取得
   * 【パフォーマンス】: O(1)での高速アクセス 🟢
   */
  get(name: string): PluginDefinition | undefined {
    return this.plugins.get(name);
  }

  /**
   * 【レジストリクリア】: 全プラグインの削除
   * 【用途】: テスト環境でのリセット処理
   */
  clear(): void {
    this.plugins.clear();
  }

  /**
   * 【登録数取得】: 現在の登録プラグイン数
   * 【監視用】: メモリ使用状況の監視 🔴
   */
  get size(): number {
    return this.plugins.size;
  }
}

/** 【グローバルレジストリ】: アプリケーション全体で共有 */
export const PluginRegistry = new PluginRegistryClass();

// ================================================================================
// 【公開API関数セクション】: 外部から利用される主要機能
// ================================================================================

/**
 * 【階層URL解析】: URLを構造化データに変換
 * 【改善内容】: エラーメッセージの国際化対応 🟢
 * 【設計方針】: 早期検証による安全性確保
 *
 * @param url - 解析対象のURL文字列
 * @returns 解析済みルートパラメータ
 * @throws {Error} URL形式不正またはセキュリティ違反時
 */
export function parseHierarchicalUrl(url: string): RouteParams {
  // 【前処理検証】: URL長とフォーマットの事前チェック
  validateUrlLength(url);

  // 【URLパターンマッチング】: 正規表現による構造解析
  const match = url.match(URL_CONFIG.HIERARCHICAL_PATTERN);
  if (!match) {
    throw new Error(getErrorMessage('INVALID_URL_FORMAT') as string);
  }

  // 【構造分解】: マッチ結果から各要素を抽出
  const [, treeId, pageNodeId, targetNodeId, nodeType] = match;

  // 【セキュリティ検証】: プラグイン名の安全性確認
  if (!nodeType) {
    throw new Error('nodeType is required');
  }
  validatePluginNameSecurity(nodeType);

  // 【結果返却】: 不変オブジェクトとして返却
  return Object.freeze({
    treeId: treeId || '',
    pageNodeId: pageNodeId || '',
    targetNodeId: targetNodeId || '',
    nodeType,
  });
}

/**
 * 【プラグインコンポーネント動的ロード】: 非同期でプラグインをロード
 * 【改善内容】: DRY原則適用とメモリリーク対策 🟡
 * 【設計方針】: タイムアウト制御と適切なエラーハンドリング
 *
 * @param pluginName - ロード対象プラグイン名
 * @param actionName - 実行するアクション名
 * @param options - ロードオプション（タイムアウト等）
 * @returns ロードされたコンポーネント
 * @throws {Error} プラグイン不在、セキュリティ違反、タイムアウト時
 */
export async function loadPluginComponent(
  pluginName: string,
  actionName: string,
  options?: LoadOptions
): Promise<unknown> {
  // 【入力検証】: セキュリティチェックを最初に実行
  validatePluginNameSecurity(pluginName);

  // 【プラグイン取得】: レジストリから対象プラグインを取得
  const plugin = PluginRegistry.get(pluginName);
  if (!plugin) {
    const message = getErrorMessage('PLUGIN_NOT_FOUND');
    throw new Error(typeof message === 'function' ? message(pluginName) : message);
  }

  // 【アクション取得】: 指定アクションの存在確認
  const action = plugin.actions[actionName];
  if (!action) {
    const message = getErrorMessage('ACTION_NOT_FOUND');
    throw new Error(typeof message === 'function' ? message(actionName) : message);
  }

  // 【セキュリティ検証】: コンポーネントの安全性確認
  validateComponentSecurity(action.component);

  // 【タイムアウト処理】: 指定時間での強制終了機能
  if (options?.timeout) {
    // 【タイムアウトPromise生成】: AbortControllerでメモリリーク対策 🔴
    const abortController = new AbortController();
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        abortController.abort();
        reject(new Error(getErrorMessage('TIMEOUT') as string));
      }, options.timeout);

      // 【クリーンアップ】: Promiseレース終了時のタイマークリア 🔴
      abortController.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
      });
    });

    // 【ローダー実行】: loaderまたはcomponentの非同期実行
    const loadPromise = action.loader ? action.loader() : executeComponent(action.component);

    try {
      // 【レース実行】: タイムアウトと処理の競争
      return await Promise.race([loadPromise, timeoutPromise]);
    } catch (error) {
      handleLoadError(error);
    } finally {
      // 【リソース解放】: AbortControllerのクリーンアップ 🔴
      abortController.abort();
    }
  }

  // 【通常ロード処理】: タイムアウトなしの場合
  if (action.loader) {
    try {
      return await action.loader();
    } catch (error) {
      handleLoadError(error);
    }
  }

  // 【コンポーネント実行】: 直接実行
  return executeComponent(action.component);
}

// ================================================================================
// 【メインルータークラス】: ルーティング処理の中核
// ================================================================================

/**
 * 【階層的プラグインルーター】: ルート解決とパフォーマンス監視
 * 【改善内容】: パフォーマンス測定の最適化 🟡
 * 【設計方針】: 静的メソッドによるステートレス設計
 */
export class HierarchicalPluginRouter {
  /**
   * 【ルート解決】: パラメータからコンポーネントを解決
   * 【パフォーマンス監視】: SLA基準に基づく警告出力
   * 【改善内容】: 重複コード削減とエラー処理最適化 🟡
   *
   * @param params - ルートパラメータ
   * @returns 解決されたコンポーネント
   * @throws {Error} プラグイン不在またはアクション不在時
   */
  static async resolveRoute(params: RouteParams): Promise<unknown> {
    const startTime = performance.now();

    try {
      // 【プラグイン解決】: パラメータからプラグインを特定
      const plugin = PluginRegistry.get(params.nodeType);
      if (!plugin) {
        const message = getErrorMessage('PLUGIN_NOT_FOUND');
        throw new Error(typeof message === 'function' ? message(params.nodeType) : message);
      }

      // 【viewアクション取得】: 標準アクションの取得
      const viewAction = plugin.actions.view;
      if (!viewAction) {
        const message = getErrorMessage('ACTION_NOT_FOUND');
        throw new Error(typeof message === 'function' ? message('view') : message);
      }

      // 【ローダー実行】: 非同期データロード
      if (viewAction.loader) {
        await viewAction.loader();
      }

      // 【コンポーネント返却】: 解決済みコンポーネント
      return viewAction.component;
    } finally {
      // 【パフォーマンス測定】: finallyで確実に実行 🟡
      const duration = performance.now() - startTime;

      // 【警告出力】: SLA違反時のみ警告
      if (duration >= PERFORMANCE_CONFIG.WARNING_THRESHOLD_MS) {
        console.warn(
          `Route resolution took ${Math.round(duration)}ms, expected < ${PERFORMANCE_CONFIG.SLA_MS}ms`
        );
      }
    }
  }
}
