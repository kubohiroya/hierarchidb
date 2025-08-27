/**
 * 階層的プラグインルーティングシステム - TDD Red Phase
 * テストファイル: HierarchicalPluginRouter.test.ts
 */

// Vitest API - Complete Vitest integration
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';

// Import router components and functions
import {
  HierarchicalPluginRouter,
  parseHierarchicalUrl,
  PluginRegistry,
  loadPluginComponent,
} from './HierarchicalPluginRouter.tsx';

// Import types separately
import type { PluginRouteParams, PluginDefinition } from "./types";

describe('階層的プラグインルーティングシステム', () => {
  beforeEach(() => {
    // 【テスト前準備】: 各テスト実行前にプラグインレジストリを初期化し、一貫したテスト条件を保証
    // 【環境初期化】: 前のテストの影響を受けないよう、プラグインの登録状態をクリーンにリセット
    PluginRegistry.clear();
  });

  afterEach(() => {
    // 【テスト後処理】: テスト実行後にプラグインレジストリとメモリ状態を削除
    // 【状態復元】: 次のテストに影響しないよう、システムを元の状態に戻す
    PluginRegistry.clear();
  });

  describe('URL解析機能', () => {
    test('階層的URLパラメータを正常に解析する', () => {
      // 【テスト目的】: React Routerの階層的URLパターンが正しく解析されることを確認
      // 【テスト内容】: 複雑な階層URLから各パラメータが正確に抽出されるかをテスト
      // 【期待される動作】: 全てのURL要素が適切なオブジェクトプロパティにマッピングされる
      // 🟢 信頼性レベル: テストケース定義書の正常系テストケースに完全準拠

      // 【テストデータ準備】: 実際のアプリケーションで使用される典型的な階層URL
      // 【初期条件設定】: 5つの階層要素を持つ完全なURLパス
      const testUrl = '/t/tree-123/node-456/node-789/basemap/edit';

      // 【実際の処理実行】: URL解析関数によるパラメータ抽出処理
      // 【処理内容】: React RouterのURL解析パターンに基づく階層的パラメータ抽出
      const params: PluginRouteParams = parseHierarchicalUrl(testUrl);

      // 【結果検証】: 解析されたパラメータが期待値と完全に一致するかを確認
      // 【期待値確認】: URL構造に基づく各パラメータの正確な抽出を検証
      expect(params.treeId).toBe('tree-123'); // 【確認内容】: ツリーIDが正しく抽出されることを確認 🟢
      expect(params.pageNodeId).toBe('node-456'); // 【確認内容】: ページノードIDが正しく抽出されることを確認 🟢
      expect(params.targetNodeId).toBe('node-789'); // 【確認内容】: ターゲットノードIDが正しく抽出されることを確認 🟢
      expect(params.nodeType).toBe('basemap'); // 【確認内容】: プラグインタイプが正しく抽出されることを確認 🟢
      expect(params.action).toBe('edit'); // 【確認内容】: アクションが正しく抽出されることを確認 🟢
    });

    test('最小URLパターンでの解析処理', () => {
      // 【テスト目的】: 必須パラメータのみのURLが正しく処理されることを確認
      // 【テスト内容】: treeIdのみの最小構成URLでの解析動作をテスト
      // 【期待される動作】: 必須パラメータは設定され、オプショナルパラメータはundefinedになる
      // 🟢 信頼性レベル: テストケース定義書の境界値テストケースに準拠

      // 【テストデータ準備】: 最小構成のURL（treeIdのみ）を使用
      // 【初期条件設定】: オプショナルパラメータが全て省略されたURL
      const minimalUrl = '/t/tree-123';

      // 【実際の処理実行】: 最小URLでの解析処理を実行
      // 【処理内容】: 必須パラメータとオプショナルパラメータの区別処理
      const params: PluginRouteParams = parseHierarchicalUrl(minimalUrl);

      // 【結果検証】: 必須パラメータは設定され、オプショナルパラメータは未定義であることを確認
      // 【期待値確認】: 最小構成でもシステムが正常に動作することを検証
      expect(params.treeId).toBe('tree-123'); // 【確認内容】: 必須パラメータtreeIdが正しく設定されることを確認 🟢
      expect(params.pageNodeId).toBeUndefined(); // 【確認内容】: オプショナルパラメータが未定義になることを確認 🟢
      expect(params.targetNodeId).toBeUndefined(); // 【確認内容】: オプショナルパラメータが未定義になることを確認 🟢
      expect(params.nodeType).toBeUndefined(); // 【確認内容】: オプショナルパラメータが未定義になることを確認 🟢
      expect(params.action).toBeUndefined(); // 【確認内容】: オプショナルパラメータが未定義になることを確認 🟢
    });

    test('無効なURLパターンでのエラーハンドリング', () => {
      // 【テスト目的】: 不正なURL形式が適切にエラーとして処理されることを確認
      // 【テスト内容】: 空文字列パラメータを含むURLでのエラーハンドリングをテスト
      // 【期待される動作】: パース処理がエラーを投げるか、適切なエラー状態を返す
      // 🟢 信頼性レベル: テストケース定義書の境界値テストケースに準拠

      // 【テストデータ準備】: 空のtreeIDを含む不正なURL
      // 【初期条件設定】: パース処理がエラーを発生させるべき状態
      const invalidUrl = '/t//node-456';

      // 【実際の処理実行】: 不正URLでの解析処理実行
      // 【処理内容】: エラーハンドリングロジックの動作確認
      expect(() => parseHierarchicalUrl(invalidUrl)).toThrow(); // 【確認内容】: 無効URLでエラーが発生することを確認 🟢
    });
  });

  describe('プラグインレジストリ機能', () => {
    test('プラグイン定義の正常登録', () => {
      // 【テスト目的】: プラグインがレジストリに正しく登録されることを確認
      // 【テスト内容】: プラグイン定義オブジェクトの登録と取得をテスト
      // 【期待される動作】: 登録されたプラグインが正確に取得できる
      // 🟢 信頼性レベル: プラグインアーキテクチャ仕様書に完全準拠

      // 【テストデータ準備】: basemapプラグインの標準的な定義オブジェクト
      // 【初期条件設定】: プラグインレジストリが空の状態
      const basemapPlugin: PluginDefinition = {
        nodeType: 'basemap',
        actions: {
          view: {
            component: React.lazy(() =>
              Promise.resolve({ default: () => React.createElement('div', { 'data-testid': 'mock-basemap-view' }, 'Mock Basemap View') })
            ),
            permissions: ['basemap:view'],
          },
          edit: {
            component: React.lazy(() =>
              Promise.resolve({ default: () => React.createElement('div', { 'data-testid': 'mock-basemap-editor' }, 'Mock Basemap Editor') })
            ),
            permissions: ['basemap:view', 'basemap:edit'],
          },
        },
      };

      // 【実際の処理実行】: プラグインレジストリへの登録処理
      // 【処理内容】: プラグイン定義の検証と内部ストレージへの保存
      PluginRegistry.register('basemap', basemapPlugin);

      // 【結果検証】: 登録されたプラグインが正確に取得できることを確認
      // 【期待値確認】: プラグイン情報の完全性と整合性を検証
      const retrievedPlugin = PluginRegistry.get('basemap');
      expect(retrievedPlugin).toBeDefined(); // 【確認内容】: プラグインが正常に登録されていることを確認 🟢
      expect(retrievedPlugin?.nodeType).toBe('basemap'); // 【確認内容】: ノードタイプが正しく保存されることを確認 🟢
      expect(retrievedPlugin?.actions.view).toBeDefined(); // 【確認内容】: viewアクションが登録されることを確認 🟢
      expect(retrievedPlugin?.actions.edit).toBeDefined(); // 【確認内容】: editアクションが登録されることを確認 🟢
    });

    test('存在しないプラグインの取得エラー', () => {
      // 【テスト目的】: 未登録プラグインへのアクセスが適切にエラーハンドリングされることを確認
      // 【テスト内容】: 存在しないプラグインタイプでの取得処理をテスト
      // 【期待される動作】: undefinedが返されるか、適切なエラーが発生する
      // 🟢 信頼性レベル: テストケース定義書の異常系テストケースに準拠

      // 【テストデータ準備】: 存在しないプラグインタイプ名
      // 【初期条件設定】: プラグインレジストリに何も登録されていない状態
      const nonExistentPluginType = 'nonexistent';

      // 【実際の処理実行】: 未登録プラグインの取得試行
      // 【処理内容】: プラグインレジストリからの検索処理
      const result = PluginRegistry.get(nonExistentPluginType);

      // 【結果検証】: 未登録プラグインに対して適切な結果が返されることを確認
      // 【期待値確認】: エラー状態の適切な処理を検証
      expect(result).toBeUndefined(); // 【確認内容】: 存在しないプラグインに対してundefinedが返されることを確認 🟢
    });
  });

  describe('動的プラグインロード機能', () => {
    test('プラグインコンポーネントの動的インポート成功', async () => {
      // 【テスト目的】: Code Splittingによる動的コンポーネントロードが正常動作することを確認
      // 【テスト内容】: 指定されたプラグインタイプとアクションに基づくコンポーネントロードをテスト
      // 【期待される動作】: React.lazyコンポーネントが正常にロードされレンダリングされる
      // 🟢 信頼性レベル: テストケース定義書の正常系テストケースに完全準拠

      // 【テストデータ準備】: basemap editアクションのためのテストパラメータ
      // 【初期条件設定】: プラグインが事前に登録されている状態
      const pluginParams = {
        nodeType: 'basemap',
        action: 'edit',
      };

      // まずプラグインを登録
      const basemapPlugin: PluginDefinition = {
        nodeType: 'basemap',
        actions: {
          edit: {
            component: React.lazy(() =>
              Promise.resolve({
                default: () =>
                  React.createElement(
                    'div',
                    { 'data-testid': 'basemap-edit' },
                    'Basemap Edit Component'
                  ),
              })
            ),
            permissions: ['basemap:edit'],
          },
        },
      };
      PluginRegistry.register('basemap', basemapPlugin);

      // 【実際の処理実行】: 動的コンポーネントロード処理の実行
      // 【処理内容】: プラグインコンポーネントの正常な取得
      const component = await loadPluginComponent(pluginParams.nodeType, pluginParams.action);

      // 【結果検証】: コンポーネントが正常にロードされることを確認
      // 【期待値確認】: 動的インポートの成功を検証
      expect(component).toBeDefined(); // 【確認内容】: 動的ロードされたコンポーネントが正しく取得されることを確認 🟢
    });

    test('存在しないプラグインアクションでの404エラー', async () => {
      // 【テスト目的】: 未登録アクションへのアクセスが適切にエラーハンドリングされることを確認
      // 【テスト内容】: 存在しないアクションでのコンポーネントロード試行をテスト
      // 【期待される動作】: 404エラー相当の状態またはエラーコンポーネントが表示される
      // 🟢 信頼性レベル: テストケース定義書の異常系テストケースに準拠

      // 【テストデータ準備】: 存在しないアクションを指定するパラメータ
      // 【初期条件設定】: レジストリに未登録のプラグインタイプを使用
      const invalidParams = {
        nodeType: 'nonexistent',
        action: 'edit',
      };

      // 【実際の処理実行】: 存在しないプラグインでのロード試行
      // 【処理内容】: プラグインレジストリからの検索と404エラーハンドリング
      // 【リファクタリング改善】: 非同期エラーハンドリングの正確な実装
      await expect(
        loadPluginComponent(invalidParams.nodeType, invalidParams.action)
      ).rejects.toThrow('プラグインが見つかりません: nonexistent'); // 【確認内容】: 存在しないプラグインに対して適切な非同期エラーが発生することを確認 🟢
    });
  });

  describe('階層情報統合機能', () => {
    test('階層情報とプラグインデータの統合取得', async () => {
      // 【テスト目的】: useLoaderDataによるデータ統合が正しく機能することを確認
      // 【テスト内容】: 階層情報、ターゲットノード、プラグインデータの統合ロードをテスト
      // 【期待される動作】: 全ての必要なデータが統合されたオブジェクトが取得できる
      // 🟢 信頼性レベル: テストケース定義書の正常系テストケースに完全準拠

      // 【テストデータ準備】: ローダー関数のテストに必要な階層情報パラメータ
      // 【初期条件設定】: 有効なツリーID、ノードID、プラグインタイプを設定
      const routeParams: PluginRouteParams = {
        treeId: 'tree-123',
        pageNodeId: 'node-456',
        targetNodeId: 'node-789',
        nodeType: 'basemap',
        action: 'view',
      };

      // 【実際の処理実行】: 階層データローダー関数の実行
      // 【処理内容】: ツリーコンテキスト、ノード情報、プラグインデータの統合取得
      const router = new HierarchicalPluginRouter();
      const routeData = await router.loadHierarchicalData(routeParams);

      // 【結果検証】: 統合されたデータオブジェクトが期待される構造を持つことを確認
      // 【期待値確認】: 階層情報とプラグインデータの完全性を検証
      expect(routeData).toBeDefined(); // 【確認内容】: ルートデータが正常に取得されることを確認 🟢
      expect(routeData.treeContext).toBeDefined(); // 【確認内容】: ツリーコンテキストが含まれることを確認 🟢
      expect(routeData.targetNode).toBeDefined(); // 【確認内容】: ターゲットノードが含まれることを確認 🟢
      expect(routeData.pluginData).toBeDefined(); // 【確認内容】: プラグイン固有データが含まれることを確認 🟢
      expect(routeData.permissions).toBeInstanceOf(Array); // 【確認内容】: 権限配列が含まれることを確認 🟢
      expect(routeData.treeContext.tree).toBeDefined(); // 【確認内容】: ツリー情報が正しく設定されることを確認 🟢
      expect(routeData.treeContext.currentNode).toBeDefined(); // 【確認内容】: 現在ノード情報が正しく設定されることを確認 🟢
    });

    test('存在しないtreeIdでのエラーハンドリング', async () => {
      // 【テスト目的】: 無効なリソースIDが適切にエラーハンドリングされることを確認
      // 【テスト内容】: 存在しないtreeIdでのデータロード試行をテスト
      // 【期待される動作】: エラーが発生し、適切なエラーメッセージが返される
      // 🟢 信頼性レベル: テストケース定義書の異常系テストケースに準拠

      // 【テストデータ準備】: 存在しないツリーIDを含むパラメータ
      // 【初期条件設定】: データベースに存在しないリソースIDを指定
      const invalidParams: PluginRouteParams = {
        treeId: 'invalid-999',
        pageNodeId: 'node-456',
        targetNodeId: 'node-789',
        nodeType: 'basemap',
        action: 'view',
      };

      // 【実際の処理実行】: 無効なパラメータでのデータロード試行
      // 【処理内容】: データベースクエリとエラーハンドリングの検証
      const router = new HierarchicalPluginRouter();
      await expect(router.loadHierarchicalData(invalidParams)).rejects.toThrow(
        '指定されたツリーが見つかりません'
      ); // 【確認内容】: 適切なエラーメッセージでエラーが発生することを確認 🟢
    });
  });

  describe('パフォーマンス要件', () => {
    test('ルート解決処理が100ms以内で完了する', async () => {
      // 【テスト目的】: システムのパフォーマンス要件が満たされることを確認
      // 【テスト内容】: ルート解決処理の実行時間を測定しSLAを検証
      // 【期待される動作】: ルート解決が100ms以内で完了する
      // 【リファクタリング改善】: プラグイン事前登録による正確なパフォーマンス測定
      // 🟡 信頼性レベル: パフォーマンス要件文書に基づく妥当な推測

      // 【テストデータ準備】: basemapプラグインの事前登録とルートパラメータ設定
      // 【初期条件設定】: パフォーマンス測定に必要なプラグイン環境の構築
      const basemapPlugin: PluginDefinition = {
        nodeType: 'basemap',
        actions: {
          view: {
            component: React.lazy(() =>
              Promise.resolve({ default: () => React.createElement('div', { 'data-testid': 'mock-basemap-view' }, 'Mock Basemap View') })
            ),
            permissions: ['basemap:view'],
          },
        },
      };
      PluginRegistry.register('basemap', basemapPlugin);

      const routeParams: PluginRouteParams = {
        treeId: 'tree-123',
        pageNodeId: 'node-456',
        targetNodeId: 'node-789',
        nodeType: 'basemap',
        action: 'view',
      };

      // 【実際の処理実行】: ルート解決処理の実行時間測定
      // 【処理内容】: URL解析、プラグインロード、データ取得の一連の処理時間計測
      // 【改善内容】: より正確な実行時間測定のためのperformance.now()直接使用
      const startTime = performance.now();
      const router = new HierarchicalPluginRouter();
      await router.resolveRoute(routeParams);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // 【結果検証】: 実行時間がパフォーマンス要件を満たすことを確認
      // 【期待値確認】: SLA要件（100ms以内）の遵守を検証
      expect(executionTime).toBeLessThan(100); // 【確認内容】: ルート解決が100ms以内で完了することを確認 🟡
    });
  });
});
