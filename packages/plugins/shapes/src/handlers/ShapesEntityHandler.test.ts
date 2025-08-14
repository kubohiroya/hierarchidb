import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TreeNodeId } from '@hierarchidb/core';
import { ShapesEntityHandler } from './ShapesEntityHandler';
import type { ShapesEntity, ShapesWorkingCopy } from '../types';

describe('ShapesEntityHandler', () => {
  let handler: ShapesEntityHandler;
  let mockCoreDB: any;
  let mockEphemeralDB: any;

  beforeEach(() => {
    // 【テスト前準備】: 各テスト実行前にモックデータベースとハンドラーを初期化
    // 【環境初期化】: 前のテストの影響を受けないよう、データベース状態をクリーンにリセット

    // 【モック用データストレージ】: テスト用の仮想データベース（テーブル別に分離）
    const coreStorage = new Map(); // shapes テーブル用
    const metadataStorage = new Map(); // shapes_metadata テーブル用
    const ephemeralStorage = new Map();

    mockCoreDB = {
      table: vi.fn().mockImplementation((tableName: string) => ({
        add: vi.fn().mockImplementation(async (data: any) => {
          if (tableName === 'shapes') {
            coreStorage.set(data.nodeId, data);
          } else if (tableName === 'shapes_metadata') {
            metadataStorage.set(data.shapesId, data);
          }
          return data;
        }),
        get: vi.fn().mockImplementation(async (key: string) => {
          if (tableName === 'shapes') {
            return coreStorage.get(key);
          } else if (tableName === 'shapes_metadata') {
            return metadataStorage.get(key);
          }
          return undefined;
        }),
        put: vi.fn().mockImplementation(async (data: any) => {
          if (tableName === 'shapes') {
            coreStorage.set(data.nodeId, data);
          } else if (tableName === 'shapes_metadata') {
            metadataStorage.set(data.shapesId, data);
          }
          return data;
        }),
        update: vi.fn().mockImplementation(async (key: string, data: any) => {
          if (tableName === 'shapes') {
            const existing = coreStorage.get(key);
            if (existing) {
              const updated = { ...existing, ...data };
              coreStorage.set(key, updated);
              return updated;
            }
          } else if (tableName === 'shapes_metadata') {
            const existing = metadataStorage.get(key);
            if (existing) {
              const updated = { ...existing, ...data };
              metadataStorage.set(key, updated);
              return updated;
            }
          }
          return undefined;
        }),
        delete: vi.fn().mockImplementation(async (key: string) => {
          if (tableName === 'shapes') {
            coreStorage.delete(key);
          } else if (tableName === 'shapes_metadata') {
            metadataStorage.delete(key);
          }
        }),
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            delete: vi.fn(),
          }),
        }),
      })),
    };

    mockEphemeralDB = {
      table: vi.fn().mockImplementation((tableName: string) => ({
        add: vi.fn().mockImplementation(async (data: any) => {
          ephemeralStorage.set(data.workingCopyId || data.taskId, data);
          return data;
        }),
        get: vi.fn().mockImplementation(async (key: string) => {
          return ephemeralStorage.get(key);
        }),
        put: vi.fn().mockImplementation(async (data: any) => {
          ephemeralStorage.set(data.workingCopyId || data.taskId, data);
          return data;
        }),
        update: vi.fn().mockImplementation(async (key: string, data: any) => {
          const existing = ephemeralStorage.get(key);
          if (existing) {
            const updated = { ...existing, ...data };
            ephemeralStorage.set(key, updated);
            return updated;
          }
          return undefined;
        }),
        delete: vi.fn().mockImplementation(async (key: string) => {
          ephemeralStorage.delete(key);
        }),
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            delete: vi.fn(),
          }),
        }),
      })),
    };

    handler = new ShapesEntityHandler(mockCoreDB, mockEphemeralDB);
  });

  afterEach(() => {
    // 【テスト後処理】: テスト実行後にモックをリセット
    // 【状態復元】: 次のテストに影響しないよう、モックの呼び出し履歴をクリア
    vi.clearAllMocks();
  });

  describe('正常系テストケース', () => {
    it('TEST-001: 新規Shapesエンティティ作成の正常動作確認', async () => {
      // 【テスト目的】: ShapesEntityHandler.createEntity()の基本動作を確認
      // 【テスト内容】: 最小限の必須フィールドでエンティティを作成し、デフォルト値が適切に設定されることを検証
      // 【期待される動作】: 空のGeoJSON FeatureCollectionでエンティティが作成され、デフォルトスタイルが適用される
      // 🟢 信頼性レベル: 要件定義書REQ-001に明記された内容に基づく

      // 【テストデータ準備】: 最小限の必須フィールドのみを指定して、デフォルト値の適用を確認
      // 【初期条件設定】: 新規作成のため、既存データは存在しない前提
      const nodeId: TreeNodeId = 'shapes-001' as TreeNodeId;
      const data = {
        name: 'Tokyo Districts',
        description: '東京都の行政区域',
      };

      // 【実際の処理実行】: createEntityメソッドを呼び出してエンティティを作成
      // 【処理内容】: 指定されたデータとデフォルト値を組み合わせてShapesEntityを生成
      const result = await handler.createEntity(nodeId, data);

      // 【結果検証】: 作成されたエンティティが期待される構造と値を持つことを確認
      // 【期待値確認】: REQ-001に基づく初期値設定とデフォルトスタイル適用を検証
      expect(result.nodeId).toBe('shapes-001'); // 【確認内容】: 指定したnodeIdが正しく設定されている 🟢
      expect(result.name).toBe('Tokyo Districts'); // 【確認内容】: 名前が正しく設定されている 🟢
      expect(result.description).toBe('東京都の行政区域'); // 【確認内容】: 説明が正しく設定されている 🟢
      expect(result.geojsonData).toBe('{"type":"FeatureCollection","features":[]}'); // 【確認内容】: 空のFeatureCollectionが設定されている 🟢
      expect(result.layerConfig).toEqual({
        visible: true,
        opacity: 0.8,
        zIndex: 1,
        interactive: true,
      }); // 【確認内容】: デフォルトのレイヤー設定が適用されている 🟢
      expect(result.defaultStyle.polygon).toEqual({
        fillColor: '#3388ff',
        fillOpacity: 0.6,
        strokeColor: '#0066cc',
        strokeWidth: 2,
      }); // 【確認内容】: デフォルトのポリゴンスタイルが適用されている 🟢
      expect(result.version).toBe(1); // 【確認内容】: 初期バージョンが1に設定されている 🟢
      expect(result.createdAt).toBeDefined(); // 【確認内容】: 作成日時が設定されている 🟢
      expect(result.updatedAt).toBeDefined(); // 【確認内容】: 更新日時が設定されている 🟢
    });

    it('TEST-002: 有効なGeoJSONファイルのインポート成功', async () => {
      // 【テスト目的】: importGeoJSON()メソッドの正常処理を確認
      // 【テスト内容】: RFC 7946準拠のGeoJSONデータを正しく解析・保存できることを検証
      // 【期待される動作】: 渋谷区のポリゴンデータが正しくインポートされ、メタデータが更新される
      // 🟢 信頼性レベル: 要件定義書REQ-002に基づく

      // 【テストデータ準備】: 渋谷区の簡略化された境界ポリゴンを含む有効なGeoJSON
      // 【初期条件設定】: 先にエンティティを作成
      const nodeId: TreeNodeId = 'shapes-001' as TreeNodeId;

      // エンティティを先に作成
      await handler.createEntity(nodeId, {
        name: 'Test Shape',
        description: 'Test shape for GeoJSON import',
      });
      const geojsonData = JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [139.6917, 35.6595],
                  [139.7044, 35.6595],
                  [139.7044, 35.6762],
                  [139.6917, 35.6762],
                  [139.6917, 35.6595],
                ],
              ],
            },
            properties: { name: 'Shibuya', population: 230000 },
          },
        ],
      });

      // 【実際の処理実行】: importGeoJSONメソッドでGeoJSONデータをインポート
      // 【処理内容】: GeoJSONを検証し、エンティティのgeojsonDataフィールドを更新
      await handler.importGeoJSON(nodeId, geojsonData);

      // 【結果検証】: インポート後のエンティティ状態を確認
      // 【期待値確認】: GeoJSONデータが正しく保存され、メタデータが更新されていることを検証
      const entity = await handler.getEntity(nodeId);
      expect(entity).toBeDefined(); // 【確認内容】: エンティティが存在する 🟢
      expect(JSON.parse(entity!.geojsonData)).toEqual(JSON.parse(geojsonData)); // 【確認内容】: GeoJSONデータが正しく保存されている 🟢
      expect(mockCoreDB.table).toHaveBeenCalledWith('shapes'); // 【確認内容】: shapesテーブルが更新されている 🟢
      expect(mockCoreDB.table).toHaveBeenCalledWith('shapes_metadata'); // 【確認内容】: メタデータテーブルが更新されている 🟢
    });

    it('TEST-003: Working Copyによる安全な編集機能', async () => {
      // 【テスト目的】: createWorkingCopy()とcommitWorkingCopy()の連携を確認
      // 【テスト内容】: Draft状態での編集が正しくコミットされることを検証
      // 【期待される動作】: Working CopyがEphemeralDBに作成され、編集後CoreDBに反映される
      // 🟢 信頼性レベル: 要件定義書REQ-005、REQ-201に準拠

      // 【テストデータ準備】: 既存エンティティと更新内容を準備
      // 【初期条件設定】: 元のエンティティを作成
      const nodeId: TreeNodeId = 'shapes-001' as TreeNodeId;

      // エンティティを先に作成
      await handler.createEntity(nodeId, {
        name: 'Original Name',
        description: 'Original test shape',
      });

      const originalEntity: ShapesEntity = {
        nodeId,
        name: 'Original Name',
        geojsonData: '{"type":"FeatureCollection","features":[]}',
        layerConfig: { visible: true, opacity: 0.8, zIndex: 1, interactive: true },
        defaultStyle: {
          polygon: {
            fillColor: '#3388ff',
            fillOpacity: 0.6,
            strokeColor: '#0066cc',
            strokeWidth: 2,
          },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      // 【実際の処理実行】: Working Copy作成、編集、コミットの一連の流れ
      // 【処理内容】: 安全な編集のためのWorking Copy機能を実行
      const workingCopy = await handler.createWorkingCopy(nodeId);
      expect(workingCopy.workingCopyId).toBeDefined(); // 【確認内容】: Working Copy IDが生成されている 🟢
      expect(workingCopy.workingCopyOf).toBe(nodeId); // 【確認内容】: 元のエンティティIDが記録されている 🟢
      expect(workingCopy.isDirty).toBe(false); // 【確認内容】: 初期状態ではdirtyフラグがfalse 🟢

      // Working Copyを編集
      const changes = {
        name: 'Updated Tokyo Districts',
        layerConfig: { opacity: 0.5 },
      };
      await handler.updateWorkingCopy(workingCopy.workingCopyId, changes);

      // 【結果検証】: Working Copyのコミットが正しく動作することを確認
      // 【期待値確認】: 変更がCoreDBに反映され、バージョンが更新されることを検証
      await handler.commitWorkingCopy(nodeId, workingCopy.workingCopyId);
      const updatedEntity = await handler.getEntity(nodeId);
      expect(updatedEntity!.name).toBe('Updated Tokyo Districts'); // 【確認内容】: 名前が更新されている 🟢
      expect(updatedEntity!.layerConfig.opacity).toBe(0.5); // 【確認内容】: 透明度が更新されている 🟢
      expect(updatedEntity!.version).toBe(2); // 【確認内容】: バージョンがインクリメントされている 🟢
    });

    it('TEST-004: 図形タイプ別デフォルトスタイル設定', async () => {
      // 【テスト目的】: ポリゴン、ライン、ポイントのスタイル設定を確認
      // 【テスト内容】: 各図形タイプに対してスタイルが正しく適用されることを検証
      // 【期待される動作】: REQ-101に基づくデフォルトスタイル自動適用
      // 🟢 信頼性レベル: 要件定義書REQ-004、REQ-101に明記

      // 【テストデータ準備】: 各図形タイプのスタイル設定を含むデータ
      // 【初期条件設定】: スタイル設定を含むエンティティ作成
      const nodeId: TreeNodeId = 'shapes-002' as TreeNodeId;
      const styleData = {
        name: 'Styled Shapes',
        defaultStyle: {
          polygon: {
            fillColor: '#ff0000',
            fillOpacity: 0.7,
            strokeColor: '#990000',
            strokeWidth: 3,
          },
          line: { color: '#00ff00', width: 3, opacity: 0.9, pattern: 'dashed' as const },
          point: { radius: 8, fillColor: '#0000ff', strokeColor: '#000066', strokeWidth: 2 },
        },
      };

      // 【実際の処理実行】: スタイル設定を含むエンティティを作成
      // 【処理内容】: 指定されたスタイルがデフォルトスタイルとして適用される
      const result = await handler.createEntity(nodeId, styleData);

      // 【結果検証】: 各図形タイプのスタイルが正しく設定されていることを確認
      // 【期待値確認】: カスタムスタイルが優先され、未指定部分はデフォルト値が適用される
      expect(result.defaultStyle.polygon?.fillColor).toBe('#ff0000'); // 【確認内容】: ポリゴンの塗りつぶし色が設定されている 🟢
      expect(result.defaultStyle.polygon?.fillOpacity).toBe(0.7); // 【確認内容】: ポリゴンの透明度が設定されている 🟢
      expect(result.defaultStyle.line?.color).toBe('#00ff00'); // 【確認内容】: ラインの色が設定されている 🟢
      expect(result.defaultStyle.line?.pattern).toBe('dashed'); // 【確認内容】: ラインのパターンが設定されている 🟢
      expect(result.defaultStyle.point?.radius).toBe(8); // 【確認内容】: ポイントの半径が設定されている 🟢
      expect(result.defaultStyle.point?.fillColor).toBe('#0000ff'); // 【確認内容】: ポイントの塗りつぶし色が設定されている 🟢
    });

    it('TEST-005: 複数URLからの同時データ取得（バッチ処理）', async () => {
      // 【テスト目的】: WebWorkerによる並行処理（最大4並行）を確認
      // 【テスト内容】: 複数のGeoJSONソースが正しく統合されることを検証
      // 【期待される動作】: 2つの外部データソースから並行取得し、進捗通知が送信される
      // 🟡 信頼性レベル: 要件定義書REQ-501、REQ-102から妥当な推測

      // 【テストデータ準備】: 複数の外部データソースの設定
      // 【初期条件設定】: バッチ処理用のタスク設定
      const nodeId: TreeNodeId = 'shapes-003' as TreeNodeId;
      const sources = [
        { id: 'src1', url: 'https://example.com/data1.geojson', format: 'geojson' },
        { id: 'src2', url: 'https://example.com/data2.geojson', format: 'geojson' },
      ];
      const options = {
        concurrent: 2,
        timeout: 30000,
        retryCount: 3,
      };

      // 【実際の処理実行】: バッチ処理を開始
      // 【処理内容】: 複数URLからデータを並行ダウンロードして統合
      const taskId = await handler.startBatchProcessing(nodeId, sources, options);

      // 【結果検証】: バッチ処理タスクが正しく作成されていることを確認
      // 【期待値確認】: タスクIDが生成され、処理が開始される
      expect(taskId).toMatch(/^batch-shapes-003-\d+$/); // 【確認内容】: タスクIDが正しい形式で生成されている 🟡
      expect(mockEphemeralDB.table).toHaveBeenCalledWith('shapes_batch_tasks'); // 【確認内容】: バッチタスクテーブルに記録されている 🟢
    });
  });

  describe('異常系テストケース', () => {
    it('TEST-101: 無効なGeoJSONインポート時のエラー処理', async () => {
      // 【テスト目的】: RFC 7946に準拠しないGeoJSONの拒否を確認
      // 【テスト内容】: 不正なGeoJSON形式がエラーとして検出されることを検証
      // 【期待される動作】: エラーメッセージと修正提案が提示される
      // 🟢 信頼性レベル: EDGE-001に明記

      // 【テストデータ準備】: 不正なGeoJSON形式のデータ
      // 【初期条件設定】: typeがFeatureCollectionでない、featuresが配列でない
      const nodeId: TreeNodeId = 'shapes-001' as TreeNodeId;
      const invalidGeojson = JSON.stringify({
        type: 'InvalidType',
        features: 'not-an-array',
      });

      // 【実際の処理実行】: 不正なGeoJSONのインポートを試行
      // 【処理内容】: importGeoJSONメソッドがエラーをスローすることを期待
      await expect(handler.importGeoJSON(nodeId, invalidGeojson)).rejects.toThrow(
        'Invalid GeoJSON: Expected FeatureCollection'
      ); // 【確認内容】: 適切なエラーメッセージがスローされる 🟢
    });

    it('TEST-102: ファイルサイズ超過エラー', async () => {
      // 【テスト目的】: 100MB超のファイルアップロード拒否を確認
      // 【テスト内容】: メモリ制限超過の防止機能を検証
      // 【期待される動作】: ファイルサイズエラーが適切に処理される
      // 🟢 信頼性レベル: 要件定義書に100MB制限明記

      // 【テストデータ準備】: 100MBを超えるサイズのデータ
      // 【初期条件設定】: 大きなGeoJSONデータを生成
      const nodeId: TreeNodeId = 'shapes-001' as TreeNodeId;
      const largeData = 'x'.repeat(101 * 1024 * 1024); // 101MB

      // 【実際の処理実行】: サイズ超過データのインポートを試行
      // 【処理内容】: ファイルサイズチェックでエラーになることを期待
      await expect(handler.importGeoJSON(nodeId, largeData, { checkSize: true })).rejects.toThrow(
        'ファイルサイズが制限を超えています (最大: 100MB)'
      ); // 【確認内容】: サイズ制限エラーが発生する 🟢
    });

    it('TEST-103: Workerクラッシュからの自動復旧', async () => {
      // 【テスト目的】: WebWorkerクラッシュ時の処理継続を確認
      // 【テスト内容】: Worker異常終了時の自動再起動機能を検証
      // 【期待される動作】: 新しいWorkerが自動起動し、処理が継続される
      // 🟢 信頼性レベル: EDGE-002に明記

      // 【テストデータ準備】: Worker処理のシミュレーション設定
      // 【初期条件設定】: Workerがクラッシュする状況を再現
      const nodeId: TreeNodeId = 'shapes-001' as TreeNodeId;
      const mockWorkerCrash = vi.fn().mockRejectedValueOnce(new Error('Worker crashed'));
      handler.processWithWorker = mockWorkerCrash;

      // 【実際の処理実行】: Worker処理を実行し、クラッシュ後の復旧を確認
      // 【処理内容】: エラー後に自動的に新しいWorkerで処理を再開
      const result = await handler.recoverFromWorkerCrash(nodeId);

      // 【結果検証】: Worker再起動と処理継続を確認
      // 【期待値確認】: データ損失なく処理が完了する
      expect(result.recovered).toBe(true); // 【確認内容】: 復旧が成功している 🟢
      expect(result.message).toContain('処理を再開しています'); // 【確認内容】: 適切なメッセージが表示される 🟢
    });

    it('TEST-105: 複数ユーザーの同時編集防止', async () => {
      // 【テスト目的】: Working Copy競合の検出と制御を確認
      // 【テスト内容】: 同一エンティティへの同時編集が防止されることを検証
      // 【期待される動作】: 競合エラーと読み取り専用アクセスの提供
      // 🟢 信頼性レベル: REQ-203に明記

      // 【テストデータ準備】: 2つのWorking Copy作成要求
      // 【初期条件設定】: エンティティを先に作成
      const nodeId: TreeNodeId = 'shapes-001' as TreeNodeId;

      // エンティティを先に作成
      await handler.createEntity(nodeId, {
        name: 'Test Shape for Concurrent Edit',
        description: 'Test shape for concurrent editing test',
      });

      // 最初のユーザーがWorking Copyを作成
      const firstWorkingCopy = await handler.createWorkingCopy(nodeId);
      expect(firstWorkingCopy).toBeDefined(); // 【確認内容】: 最初のWorking Copyは正常に作成される 🟢

      // 【実際の処理実行】: 2番目のユーザーが同じエンティティのWorking Copyを作成試行
      // 【処理内容】: 競合エラーが発生することを期待
      await expect(handler.createWorkingCopy(nodeId)).rejects.toThrow(
        'WORKING_COPY_CONFLICT: 他のユーザーが編集中です'
      ); // 【確認内容】: 競合エラーが適切に発生する 🟢
    });
  });

  describe('境界値テストケース', () => {
    it('TEST-201: 10,000個の図形要素を含むデータの処理', async () => {
      // 【テスト目的】: NFR-101で定義されたシステム上限での処理を確認
      // 【テスト内容】: パフォーマンス劣化なく処理可能であることを検証
      // 【期待される動作】: 10,000個の図形が正常にインポート・表示される
      // 🟢 信頼性レベル: NFR-101に明記

      // 【テストデータ準備】: 10,000個のポリゴンを含むGeoJSONを生成
      // 【初期条件設定】: エンティティを先に作成
      const nodeId: TreeNodeId = 'shapes-004' as TreeNodeId;

      // エンティティを先に作成
      await handler.createEntity(nodeId, {
        name: 'Large Test Shape',
        description: 'Test shape for performance testing',
      });
      const features = Array.from({ length: 10000 }, (_, i) => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [i, i],
              [i + 1, i],
              [i + 1, i + 1],
              [i, i + 1],
              [i, i],
            ],
          ],
        },
        properties: { id: i },
      }));
      const largeGeojson = JSON.stringify({
        type: 'FeatureCollection',
        features,
      });

      // 【実際の処理実行】: 最大数の図形をインポート
      // 【処理内容】: 10,000個の図形が正常に処理される
      const startTime = Date.now();
      await handler.importGeoJSON(nodeId, largeGeojson);
      const processingTime = Date.now() - startTime;

      // 【結果検証】: パフォーマンス要件を満たすことを確認
      // 【期待値確認】: 2秒以内の処理（NFR-001）とメモリ使用量5MB以内（REQ-404）
      expect(processingTime).toBeLessThan(2000); // 【確認内容】: 2秒以内に処理完了 🟢
      const entity = await handler.getEntity(nodeId);
      const parsedData = JSON.parse(entity!.geojsonData);
      expect(parsedData.features).toHaveLength(10000); // 【確認内容】: 全図形が正確に保存されている 🟢
    });

    it('TEST-202: 空のGeoJSON処理', async () => {
      // 【テスト目的】: features配列が空のGeoJSON処理を確認
      // 【テスト内容】: 空データでもエラーなく処理されることを検証
      // 【期待される動作】: 正常に保存され、適切なメタデータが設定される
      // 🟢 信頼性レベル: 基本的なGeoJSON仕様

      // 【テストデータ準備】: 空のFeatureCollectionを作成
      // 【初期条件設定】: エンティティを先に作成
      const nodeId: TreeNodeId = 'shapes-005' as TreeNodeId;

      // エンティティを先に作成
      await handler.createEntity(nodeId, {
        name: 'Empty Test Shape',
        description: 'Test shape for empty GeoJSON',
      });
      const emptyGeojson = JSON.stringify({
        type: 'FeatureCollection',
        features: [],
      });

      // 【実際の処理実行】: 空のGeoJSONをインポート
      // 【処理内容】: エラーなく処理される
      await handler.importGeoJSON(nodeId, emptyGeojson);

      // 【結果検証】: 空データが適切に処理されていることを確認
      // 【期待値確認】: メタデータが正しく設定される
      const entity = await handler.getEntity(nodeId);
      expect(entity).toBeDefined(); // 【確認内容】: エンティティが存在する 🟢
      const metadata = await handler.getMetadata(nodeId);
      expect(metadata.featureCount).toBe(0); // 【確認内容】: featureCountが0 🟢
      expect(metadata.totalVertices).toBe(0); // 【確認内容】: totalVerticesが0 🟢
    });

    it('TEST-203: 座標値の有効範囲チェック', async () => {
      // 【テスト目的】: 経度±180度、緯度±90度の境界値処理を確認
      // 【テスト内容】: 境界値でのクランプ処理が正しく動作することを検証
      // 【期待される動作】: 範囲外の座標値が適切にクランプされる
      // 🟢 信頼性レベル: EDGE-101に明記

      // 【テストデータ準備】: 境界値と範囲外の座標値を含むデータ
      // 【初期条件設定】: エンティティを先に作成
      const nodeId: TreeNodeId = 'shapes-006' as TreeNodeId;

      // エンティティを先に作成
      await handler.createEntity(nodeId, {
        name: 'Boundary Test Shape',
        description: 'Test shape for coordinate boundary validation',
      });
      const boundaryGeojson = JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [181.0, 91.0], // 範囲外の座標
            },
            properties: {},
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-181.0, -91.0], // 範囲外の座標
            },
            properties: {},
          },
        ],
      });

      // 【実際の処理実行】: 範囲外座標を含むGeoJSONをインポート
      // 【処理内容】: 座標値のクランプ処理が実行される
      await handler.importGeoJSON(nodeId, boundaryGeojson, { validateCoordinates: true });

      // 【結果検証】: 座標値が有効範囲内にクランプされていることを確認
      // 【期待値確認】: 181→180、91→90にクランプされる
      const entity = await handler.getEntity(nodeId);
      const parsedData = JSON.parse(entity!.geojsonData);
      expect(parsedData.features[0].geometry.coordinates[0]).toBe(180.0); // 【確認内容】: 経度が180にクランプ 🟢
      expect(parsedData.features[0].geometry.coordinates[1]).toBe(90.0); // 【確認内容】: 緯度が90にクランプ 🟢
      expect(parsedData.features[1].geometry.coordinates[0]).toBe(-180.0); // 【確認内容】: 経度が-180にクランプ 🟢
      expect(parsedData.features[1].geometry.coordinates[1]).toBe(-90.0); // 【確認内容】: 緯度が-90にクランプ 🟢
    });
  });
});
