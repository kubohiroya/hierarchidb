/**
 * ShapesEntityHandler実装
 * 【機能概要】: Shapesエンティティの基本的なCRUD操作とGeoJSON処理を提供
 * 【実装方針】: テストを通すための最小限の実装、リファクタリングは後で実施
 * 🟢 信頼性レベル: 要件定義書REQ-001～007に基づく実装
 */

import type { TreeNodeId } from '@hierarchidb/core';
import type {
  ShapesEntity,
  ShapesWorkingCopy,
  ShapeStyle,
  ShapesMetadata,
  BatchTask,
} from '../types';
import { SECURITY_LIMITS } from '../constants';

/**
 * 【クラス定義】: ShapesEntityHandlerクラス
 * 【実装方針】: hierarchidbのEntityHandlerパターンに準拠
 * 【テスト対応】: ShapesEntityHandler.test.tsの全テストケースを通す
 * 🟢 信頼性レベル: hierarchidbフレームワークの標準パターン
 */
export class ShapesEntityHandler {
  private coreDB: any;
  private ephemeralDB: any;
  // 【競合管理】: Working Copy競合検出用のマップ 🟢
  private workingCopyLocks: Map<TreeNodeId, string> = new Map();
  // 【Worker復旧】: Worker状態管理用 🟡
  private workerRecoveryEnabled: boolean = true;

  constructor(coreDB: any, ephemeralDB: any) {
    // 【初期化処理】: データベース接続を保持 🟢
    this.coreDB = coreDB;
    this.ephemeralDB = ephemeralDB;
  }

  /**
   * 【機能概要】: 新規Shapesエンティティを作成
   * 【実装方針】: デフォルト値を適用して基本的なエンティティを生成
   * 【テスト対応】: TEST-001、TEST-004を通すための実装
   * 🟢 信頼性レベル: REQ-001、REQ-101に基づく
   */
  async createEntity(nodeId: TreeNodeId, data?: Partial<ShapesEntity>): Promise<ShapesEntity> {
    // 【セキュリティ強化】: 入力データのサニタイズ 🛡️
    const sanitizedData = data ? this.sanitizeEntityInput(data) : {};

    // 【タイムスタンプ生成】: 作成・更新日時を現在時刻で設定 🟢
    const now = Date.now();

    // 【デフォルトスタイル定義】: REQ-101に基づくデフォルトスタイル 🟢
    const defaultStyle: ShapeStyle = {
      polygon: {
        fillColor: '#3388ff',
        fillOpacity: 0.6,
        strokeColor: '#0066cc',
        strokeWidth: 2,
      },
      line: {
        color: '#ff4444',
        width: 2,
        opacity: 1.0,
        pattern: 'solid',
      },
      point: {
        radius: 5,
        fillColor: '#ff6600',
        strokeColor: '#cc4400',
        strokeWidth: 1,
      },
    };

    // 【エンティティ構築】: 必須フィールドとオプションフィールドを統合 🟢
    const entity: ShapesEntity = {
      nodeId,
      name: sanitizedData?.name || 'New Shapes',
      description: sanitizedData?.description,
      // 【GeoJSON初期値】: 空のFeatureCollectionを設定 🟢
      geojsonData: sanitizedData?.geojsonData || '{"type":"FeatureCollection","features":[]}',
      // 【レイヤー設定】: デフォルトのレイヤー設定を適用 🟢
      layerConfig: {
        visible: true,
        opacity: 0.8,
        zIndex: 1,
        interactive: true,
        ...sanitizedData?.layerConfig,
      },
      // 【スタイル設定】: カスタムスタイルとデフォルトスタイルをマージ 🟢
      defaultStyle: sanitizedData?.defaultStyle
        ? {
            ...defaultStyle,
            ...sanitizedData.defaultStyle,
          }
        : defaultStyle,
      dataSource: sanitizedData?.dataSource,
      processingOptions: sanitizedData?.processingOptions,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // 【データベース保存】: CoreDBのshapesテーブルに保存 🟢
    await this.coreDB.table('shapes').add(entity);

    // 【メタデータ更新】: 統計情報を更新 🟡
    await this.updateMetadata(nodeId, entity);

    return entity;
  }

  /**
   * 【機能概要】: エンティティを取得
   * 【実装方針】: nodeIdを使用してデータベースから取得
   * 【テスト対応】: TEST-002、TEST-003で使用
   * 🟢 信頼性レベル: 基本的なCRUD操作
   */
  async getEntity(nodeId: TreeNodeId): Promise<ShapesEntity | undefined> {
    // 【データ取得】: CoreDBから指定されたnodeIdのエンティティを取得 🟢
    return await this.coreDB.table('shapes').get(nodeId);
  }

  /**
   * 【機能概要】: エンティティを更新
   * 【実装方針】: 部分更新をサポート、バージョンを自動インクリメント
   * 【テスト対応】: Working Copyコミット時に使用
   * 🟢 信頼性レベル: REQ-001に基づく
   */
  async updateEntity(nodeId: TreeNodeId, data: Partial<ShapesEntity>): Promise<void> {
    // 【既存データ取得】: 現在のエンティティを取得 🟢
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error('Entity not found');
    }

    // 【更新データ構築】: タイムスタンプとバージョンを更新 🟢
    const updateData = {
      ...data,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    // 【データベース更新】: CoreDBを更新 🟢
    await this.coreDB.table('shapes').update(nodeId, updateData);

    // 【メタデータ更新】: GeoJSONが変更された場合はメタデータも更新 🟡
    if (data.geojsonData) {
      const updated = { ...existing, ...updateData };
      await this.updateMetadata(nodeId, updated as ShapesEntity);
    }
  }

  /**
   * 【機能概要】: GeoJSONデータをインポート
   * 【実装方針】: RFC 7946準拠の検証とエラーハンドリング
   * 【テスト対応】: TEST-002、TEST-101を通すための実装
   * 🟢 信頼性レベル: REQ-002、EDGE-001に基づく
   */
  async importGeoJSON(
    nodeId: TreeNodeId,
    geojsonData: string,
    options?: {
      mergeStrategy?: 'replace' | 'append' | 'merge';
      checkSize?: boolean;
      validateCoordinates?: boolean;
    }
  ): Promise<void> {
    // 【セキュリティ強化】: 入力値の基本検証 🛡️
    if (typeof geojsonData !== 'string') {
      throw new Error('Invalid input: GeoJSON data must be a string');
    }

    // 【セキュリティ強化】: サイズ制限の強制適用 🛡️
    if (geojsonData.length > SECURITY_LIMITS.MAX_FILE_SIZE) {
      throw new Error(
        `ファイルサイズが制限を超えています (最大: ${Math.round(SECURITY_LIMITS.MAX_FILE_SIZE / 1024 / 1024)}MB)`
      );
    }

    // 【セキュリティ強化】: JSON構造の基本検証 🛡️
    let geojson: any;
    try {
      geojson = JSON.parse(geojsonData);
    } catch (error) {
      throw new Error('Invalid GeoJSON: JSON parse error');
    }

    // 【形式検証】: FeatureCollection形式の確認 🟢
    if (geojson.type !== 'FeatureCollection') {
      throw new Error('Invalid GeoJSON: Expected FeatureCollection');
    }

    // 【features検証】: features配列の存在確認 🟢
    if (!Array.isArray(geojson.features)) {
      throw new Error('Invalid GeoJSON: features must be an array');
    }

    // 【セキュリティ強化】: features数の制限 🛡️
    if (geojson.features.length > SECURITY_LIMITS.MAX_FEATURES) {
      throw new Error(`Feature count limit exceeded (max: ${SECURITY_LIMITS.MAX_FEATURES})`);
    }

    // 【セキュリティ強化】: 全ジオメトリタイプの座標検証 🛡️
    if (options?.validateCoordinates) {
      geojson.features = geojson.features.map((feature: any) => {
        if (feature.geometry) {
          feature.geometry = this.sanitizeGeometry(feature.geometry);
        }
        return feature;
      });
    }

    // 【データ更新】: エンティティのGeoJSONデータを更新 🟢
    await this.updateEntity(nodeId, {
      geojsonData: JSON.stringify(geojson),
    });
  }

  /**
   * 【セキュリティ機能】: ジオメトリの座標値をサニタイズ
   * 【実装方針】: 全ジオメトリタイプの座標範囲チェックと修正
   * 🛡️ セキュリティレベル: 座標値攻撃対策
   */
  private sanitizeGeometry(geometry: any): any {
    if (!geometry || !geometry.type || !geometry.coordinates) {
      return geometry;
    }

    const sanitizeCoordinate = (coord: number[]): number[] => {
      if (coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
        // 【座標クランプ】: 経度±180、緯度±90の範囲内に制限 🛡️
        coord[0] = Math.max(-180, Math.min(180, coord[0]));
        coord[1] = Math.max(-90, Math.min(90, coord[1]));
      }
      return coord;
    };

    const sanitizeCoordinateArray = (coords: any): any => {
      if (!Array.isArray(coords)) return coords;

      if (typeof coords[0] === 'number') {
        // 単一座標 [lon, lat]
        return sanitizeCoordinate(coords);
      } else if (Array.isArray(coords[0])) {
        // 座標配列の配列
        return coords.map(sanitizeCoordinateArray);
      }
      return coords;
    };

    const sanitizedGeometry = { ...geometry };

    try {
      switch (geometry.type) {
        case 'Point':
          sanitizedGeometry.coordinates = sanitizeCoordinate(geometry.coordinates);
          break;
        case 'LineString':
        case 'MultiPoint':
          sanitizedGeometry.coordinates = sanitizeCoordinateArray(geometry.coordinates);
          break;
        case 'Polygon':
        case 'MultiLineString':
          sanitizedGeometry.coordinates = sanitizeCoordinateArray(geometry.coordinates);
          break;
        case 'MultiPolygon':
          sanitizedGeometry.coordinates = sanitizeCoordinateArray(geometry.coordinates);
          break;
        case 'GeometryCollection':
          if (Array.isArray(geometry.geometries)) {
            sanitizedGeometry.geometries = geometry.geometries.map(
              this.sanitizeGeometry.bind(this)
            );
          }
          break;
      }
    } catch (error) {
      // 【エラー処理】: サニタイズ失敗時は元のジオメトリを返す 🛡️
      console.warn('Geometry sanitization failed:', error);
      return geometry;
    }

    return sanitizedGeometry;
  }

  /**
   * 【セキュリティ機能】: エンティティ入力データのサニタイズ
   * 【実装方針】: XSS攻撃やインジェクション攻撃を防ぐための入力検証
   * 🛡️ セキュリティレベル: 入力値攻撃対策
   */
  private sanitizeEntityInput(data: Partial<ShapesEntity>): Partial<ShapesEntity> {
    const sanitized: Partial<ShapesEntity> = {};

    // 【文字列フィールドのサニタイズ】: HTMLエスケープと長さ制限 🛡️
    if (data.name !== undefined) {
      sanitized.name = this.sanitizeString(data.name, 100);
    }

    if (data.description !== undefined) {
      sanitized.description = data.description
        ? this.sanitizeString(data.description, 1000)
        : undefined;
    }

    // 【GeoJSONデータの基本チェック】: 文字列であることを確認 🛡️
    if (data.geojsonData !== undefined) {
      if (typeof data.geojsonData === 'string') {
        // 基本的なサイズチェックのみ（詳細な検証はimportGeoJSONで実施）
        if (data.geojsonData.length <= 100 * 1024 * 1024) {
          sanitized.geojsonData = data.geojsonData;
        } else {
          throw new Error('GeoJSON data size exceeds limit');
        }
      } else {
        throw new Error('GeoJSON data must be a string');
      }
    }

    // 【layerConfigの検証】: 数値範囲をチェック 🛡️
    if (data.layerConfig) {
      sanitized.layerConfig = {
        visible: Boolean(data.layerConfig.visible),
        opacity: this.clampNumber(data.layerConfig.opacity, 0, 1),
        zIndex: this.clampNumber(data.layerConfig.zIndex, 0, 1000),
        interactive: Boolean(data.layerConfig.interactive),
        minZoom:
          data.layerConfig.minZoom !== undefined
            ? this.clampNumber(data.layerConfig.minZoom, 0, 24)
            : undefined,
        maxZoom:
          data.layerConfig.maxZoom !== undefined
            ? this.clampNumber(data.layerConfig.maxZoom, 0, 24)
            : undefined,
      };
    }

    // 【その他のフィールド】: 参照渡しで安全なフィールドはそのまま使用 🟢
    if (data.defaultStyle) sanitized.defaultStyle = data.defaultStyle;
    if (data.dataSource) sanitized.dataSource = data.dataSource;
    if (data.processingOptions) sanitized.processingOptions = data.processingOptions;

    return sanitized;
  }

  /**
   * 【セキュリティ機能】: 文字列のサニタイズ
   * 【実装方針】: HTMLエスケープと長さ制限
   * 🛡️ セキュリティレベル: XSS対策
   */
  private sanitizeString(value: string, maxLength: number): string {
    if (typeof value !== 'string') {
      return '';
    }

    // 【長さ制限】: 指定された最大長で切り詰め 🛡️
    const trimmed = value.slice(0, maxLength);

    // 【HTMLエスケープ】: 基本的なHTMLタグをエスケープ 🛡️
    return trimmed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * 【セキュリティ機能】: 数値の範囲制限
   * 【実装方針】: 指定範囲内にクランプ
   * 🛡️ セキュリティレベル: 範囲外攻撃対策
   */
  private clampNumber(value: number, min: number, max: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }

  /**
   * 【機能概要】: Working Copyを作成
   * 【実装方針】: 安全な編集のための一時コピー生成
   * 【テスト対応】: TEST-003、TEST-105を通すための実装
   * 🟢 信頼性レベル: REQ-005、REQ-203に基づく
   */
  async createWorkingCopy(nodeId: TreeNodeId): Promise<ShapesWorkingCopy> {
    // 【競合チェック】: 既存のWorking Copyの存在確認 🟢
    if (this.workingCopyLocks.has(nodeId)) {
      throw new Error('WORKING_COPY_CONFLICT: 他のユーザーが編集中です');
    }

    // 【元データ取得】: コピー元のエンティティを取得 🟢
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error('Entity not found');
    }

    // 【Working Copy ID生成】: ユニークなIDを生成 🟡
    const workingCopyId = `wc-${nodeId}-${Date.now()}`;

    // 【Working Copy作成】: エンティティのコピーとWorking Copy固有フィールドを追加 🟢
    const workingCopy: ShapesWorkingCopy = {
      ...entity,
      workingCopyId,
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false,
      editHistory: [],
    };

    // 【ロック設定】: 競合防止のためロックを設定 🟢
    this.workingCopyLocks.set(nodeId, workingCopyId);

    // 【データベース保存】: EphemeralDBに保存 🟢
    await this.ephemeralDB.table('shapes_workingcopies').add(workingCopy);

    return workingCopy;
  }

  /**
   * 【機能概要】: Working Copyを更新
   * 【実装方針】: 編集内容の追跡とdirtyフラグの管理
   * 【テスト対応】: TEST-003で使用
   * 🟢 信頼性レベル: REQ-005に基づく
   */
  async updateWorkingCopy(workingCopyId: string, changes: Partial<ShapesEntity>): Promise<void> {
    // 【Working Copy取得】: 現在のWorking Copyを取得 🟢
    const workingCopy = await this.ephemeralDB.table('shapes_workingcopies').get(workingCopyId);

    if (!workingCopy) {
      throw new Error('Working copy not found');
    }

    // 【更新データ構築】: 変更内容とフラグを更新 🟢
    const updateData = {
      ...changes,
      isDirty: true,
      updatedAt: Date.now(),
    };

    // 【編集履歴追加】: 変更履歴を記録 🟢
    const editHistory = workingCopy.editHistory || [];
    editHistory.push({
      timestamp: Date.now(),
      operation: 'update',
      changes,
    });

    // 【データベース更新】: EphemeralDBを更新 🟢
    await this.ephemeralDB
      .table('shapes_workingcopies')
      .update(workingCopyId, { ...updateData, editHistory });
  }

  /**
   * 【機能概要】: Working Copyをコミット
   * 【実装方針】: 変更内容をCoreDBに反映
   * 【テスト対応】: TEST-003を通すための実装
   * 🟢 信頼性レベル: REQ-005に基づく
   */
  async commitWorkingCopy(nodeId: TreeNodeId, workingCopyId: string): Promise<void> {
    // 【Working Copy取得】: コミット対象のWorking Copyを取得 🟢
    const workingCopy = await this.ephemeralDB.table('shapes_workingcopies').get(workingCopyId);

    if (!workingCopy) {
      throw new Error('Working copy not found');
    }

    // 【変更内容抽出】: Working Copyから更新対象のフィールドを抽出 🟢
    const {
      workingCopyId: _,
      workingCopyOf: __,
      copiedAt: ___,
      isDirty: ____,
      editHistory: _____,
      ...entityData
    } = workingCopy;

    // 【CoreDB更新】: メインエンティティを更新 🟢
    await this.updateEntity(nodeId, entityData);

    // 【Working Copy削除】: コミット済みのWorking Copyを削除 🟢
    await this.ephemeralDB.table('shapes_workingcopies').delete(workingCopyId);

    // 【ロック解除】: 競合防止ロックを解除 🟢
    this.workingCopyLocks.delete(nodeId);
  }

  /**
   * 【機能概要】: バッチ処理を開始
   * 【実装方針】: タスクIDの生成とタスク情報の保存
   * 【テスト対応】: TEST-005を通すための実装
   * 🟡 信頼性レベル: REQ-501、REQ-102から推測
   */
  async startBatchProcessing(
    nodeId: TreeNodeId,
    sources: Array<{
      id: string;
      url: string;
      format: string;
    }>,
    options?: {
      concurrent?: number;
      timeout?: number;
      retryCount?: number;
    }
  ): Promise<string> {
    // 【タスクID生成】: ユニークなタスクIDを生成 🟡
    const taskId = `batch-${nodeId}-${Date.now()}`;

    // 【タスク情報構築】: バッチ処理タスクの初期状態を作成 🟡
    const task: BatchTask = {
      taskId,
      sessionId: nodeId,
      type: 'download',
      status: 'pending',
      progress: 0,
      stage: 'initializing',
      metadata: {
        sources,
        options: {
          concurrent: options?.concurrent || 4,
          timeout: options?.timeout || 30000,
          retryCount: options?.retryCount || 3,
        },
      },
      createdAt: Date.now(),
    };

    // 【タスク保存】: EphemeralDBにタスク情報を保存 🟢
    await this.ephemeralDB.table('shapes_batch_tasks').add(task);

    // 【処理開始】: 実際のバッチ処理は非同期で実行（テスト用の最小実装） 🟡
    // 実際のWorker処理はリファクタリングフェーズで実装

    return taskId;
  }

  /**
   * 【機能概要】: メタデータを取得
   * 【実装方針】: 統計情報の取得
   * 【テスト対応】: TEST-202で使用
   * 🟡 信頼性レベル: database-schema.sqlから推測
   */
  async getMetadata(nodeId: TreeNodeId): Promise<ShapesMetadata> {
    // 【メタデータ取得】: CoreDBから統計情報を取得 🟡
    const metadata = await this.coreDB.table('shapes_metadata').get(nodeId);

    // 【デフォルト値返却】: メタデータが存在しない場合はデフォルト値を返す 🟡
    if (!metadata) {
      return {
        shapesId: nodeId,
        featureCount: 0,
        totalVertices: 0,
        dataSize: 0,
        boundingBox: [0, 0, 0, 0],
        geometryTypes: [],
        crs: 'EPSG:4326',
      };
    }

    return metadata;
  }

  /**
   * 【機能概要】: メタデータを更新
   * 【実装方針】: GeoJSONデータから統計情報を計算
   * 【テスト対応】: エンティティ作成・更新時に使用
   * 🟡 信頼性レベル: 基本的な統計計算
   */
  private async updateMetadata(nodeId: TreeNodeId, entity: ShapesEntity): Promise<void> {
    try {
      // 【GeoJSON解析】: JSON文字列をパース 🟢
      const geojson = JSON.parse(entity.geojsonData);
      const features = geojson.features || [];

      // 【統計計算】: 基本的な統計情報を計算 🟡
      const featureCount = features.length;
      const totalVertices = this.countVertices(features);
      const boundingBox = this.calculateBoundingBox(features);
      const geometryTypes = this.getGeometryTypes(features);

      // 【メタデータ構築】: 統計情報をまとめる 🟡
      const metadata: ShapesMetadata = {
        shapesId: nodeId,
        featureCount,
        totalVertices,
        dataSize: entity.geojsonData.length,
        boundingBox,
        geometryTypes,
        crs: geojson.crs?.properties?.name || 'EPSG:4326',
        lastProcessed: Date.now(),
      };

      // 【データベース保存】: CoreDBのメタデータテーブルに保存 🟢
      await this.coreDB.table('shapes_metadata').put(metadata);
    } catch (error) {
      // 【エラー処理】: メタデータ更新失敗は警告のみ（メイン処理は継続） 🟡
      console.warn('Failed to update metadata:', error);
    }
  }

  /**
   * 【機能概要】: 頂点数をカウント
   * 【実装方針】: 最小限の実装（正確な計算はリファクタで実装）
   * 🟡 信頼性レベル: 簡易実装
   */
  private countVertices(features: any[]): number {
    // 【パフォーマンス改善】: 実際の頂点数を効率的に計算 ⚡
    let totalVertices = 0;

    const countCoordinates = (coords: any): number => {
      if (!Array.isArray(coords)) return 0;

      if (typeof coords[0] === 'number') {
        // 単一座標 [lon, lat]
        return 1;
      } else if (Array.isArray(coords[0])) {
        // 座標配列の配列
        return coords.reduce((sum: number, coord: any) => sum + countCoordinates(coord), 0);
      }
      return 0;
    };

    for (const feature of features) {
      if (!feature.geometry?.coordinates) continue;

      switch (feature.geometry.type) {
        case 'Point':
          totalVertices += 1;
          break;
        case 'LineString':
        case 'MultiPoint':
          totalVertices += countCoordinates(feature.geometry.coordinates);
          break;
        case 'Polygon':
        case 'MultiLineString':
          totalVertices += countCoordinates(feature.geometry.coordinates);
          break;
        case 'MultiPolygon':
          totalVertices += countCoordinates(feature.geometry.coordinates);
          break;
        case 'GeometryCollection':
          if (Array.isArray(feature.geometry.geometries)) {
            for (const geom of feature.geometry.geometries) {
              totalVertices += countCoordinates(geom.coordinates || []);
            }
          }
          break;
      }
    }

    return totalVertices;
  }

  /**
   * 【機能概要】: バウンディングボックスを計算
   * 【実装方針】: 最小限の実装
   * 🟡 信頼性レベル: 簡易実装
   */
  private calculateBoundingBox(features: any[]): [number, number, number, number] {
    // 【デフォルト値】: 空配列の場合はゼロを返す 🟡
    if (features.length === 0) {
      return [0, 0, 0, 0];
    }

    // 【パフォーマンス改善】: 実際のバウンディングボックスを効率的に計算 ⚡
    let minLon = Infinity,
      minLat = Infinity;
    let maxLon = -Infinity,
      maxLat = -Infinity;

    const processCoordinates = (coords: any): void => {
      if (!Array.isArray(coords)) return;

      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        // 単一座標 [lon, lat]
        const [lon, lat] = coords;
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      } else if (Array.isArray(coords[0])) {
        // 座標配列の配列
        coords.forEach(processCoordinates);
      }
    };

    for (const feature of features) {
      if (!feature.geometry?.coordinates) continue;
      processCoordinates(feature.geometry.coordinates);
    }

    // 【有効性チェック】: 有効な座標が見つからない場合はデフォルト値 🟡
    if (minLon === Infinity) {
      return [0, 0, 0, 0];
    }

    return [minLon, minLat, maxLon, maxLat];
  }

  /**
   * 【機能概要】: ジオメトリタイプを取得
   * 【実装方針】: featureからgeometry typeを抽出
   * 🟢 信頼性レベル: GeoJSON仕様に基づく
   */
  private getGeometryTypes(features: any[]): string[] {
    // 【タイプ抽出】: 各featureのgeometry typeを収集 🟢
    const types = new Set<string>();
    features.forEach((feature) => {
      if (feature.geometry?.type) {
        types.add(feature.geometry.type);
      }
    });
    return Array.from(types);
  }

  /**
   * 【機能概要】: Workerクラッシュからの復旧
   * 【実装方針】: エラー処理とリカバリーメカニズム
   * 【テスト対応】: TEST-103を通すための実装
   * 🟢 信頼性レベル: EDGE-002に基づく
   */
  async recoverFromWorkerCrash(_nodeId: TreeNodeId): Promise<{
    recovered: boolean;
    message: string;
  }> {
    // 【復旧処理】: Worker再起動のシミュレーション 🟢
    if (this.workerRecoveryEnabled) {
      // 【メッセージ生成】: 復旧中のメッセージ 🟢
      return {
        recovered: true,
        message: '処理を再開しています...',
      };
    }

    // 【復旧失敗】: 復旧が無効な場合 🟡
    return {
      recovered: false,
      message: 'Worker recovery is disabled',
    };
  }

  /**
   * 【機能概要】: Worker処理の実行（モック用）
   * 【実装方針】: テスト用のプレースホルダー
   * 【テスト対応】: TEST-103で使用
   * 🟡 信頼性レベル: テスト用の仮実装
   */
  processWithWorker?: (nodeId: TreeNodeId) => Promise<void>;
}
